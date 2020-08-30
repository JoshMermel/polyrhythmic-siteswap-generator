/////////////
// helpers //
/////////////

// Generates a random int in the range [min, max]
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toToss(t) {
  let i = t.height;
  let ret = '';

  if (i >= 0 && i <= 9) {
    ret = String.fromCharCode(i + 48);
  } else if (i >= 10 && i <= 35) {
    ret = String.fromCharCode(i + 97 - 10);
  } else {
    return '0x'; // hack to mean that these don't get printed.
  }

  return ret + (t.x ? 'x' : '');
}

function toMultiToss(t) {
  if (t.length === 1) {
    return toToss(t[0]);
  } else {
    let ret = '[';
    for (let sub of t) {
      ret += toToss(sub);
    }
    return ret + ']';
  }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}


////////////////////////////////////////////////////////
// Untilites for mapping from vanilla to polyrhythmic //
////////////////////////////////////////////////////////

// These two methods translate throws from their vanilla height and index into
// the a string for use in the output.
function translate_multiplex(heights, start_idx, beats, period, star) {
  let ret = [];
  for (let height of heights) {
    ret.push(translate_throw(height, start_idx, beats, period, star));
  }
  return ret;
}

function translate_throw(height, start_idx, beats, period, star) {
  if (height === 0) {
    return { height : 0, x : false };
  }
  let wraparounds = 0;
  let ret = 0;
  let landing_idx = height + start_idx;
  while ((landing_idx - start_idx) > beats.length) {
    landing_idx -= beats.length;
    ret += period/2;
    wraparounds += 1;
  }
  // Indicies in the multi-hand-notation where the throw and catch happen.
  let landing_pos = beats[landing_idx % beats.length];
  let starting_pos = beats[start_idx % beats.length];
  
  while (landing_pos <= starting_pos) {
    landing_pos += period;
    wraparounds += 1;
  }
  ret += (landing_pos/2|0) - (starting_pos/2|0);
  wraparounds = star ? wraparounds : 0;

  return { height : ret,
    x : (starting_pos + landing_pos + ret + wraparounds) % 2 !== 0 };
}

function translate_siteswap(siteswap, beats, period, star) {
  let ret = [];
  for (let i = 0; i < beats.length; i++) {
    ret[beats[i]] = translate_multiplex(siteswap[i], i, beats, period, star);
  }
  return ret;
}

function print_siteswap(siteswap, period, star) {
  let last_throw_was_l = true;
  let is_first_async = true;
  let ret = '';
  for (let beat = 0; beat < period; beat += 2) {
    // sync.
    if (siteswap[beat] !== undefined && siteswap[beat+1] !== undefined) {
      ret += '(';
      ret += toMultiToss(siteswap[beat]);
      ret += ',';
      ret += toMultiToss(siteswap[beat+1]);
      ret += ')';
      if (siteswap[(beat+2) % period] === undefined && siteswap[(beat+3) % period] === undefined) {
        beat += 2;
      } else {
        ret += '!';
      }
    } else if (siteswap[beat] !== undefined) {
      // left only.
      if (last_throw_was_l || is_first_async) {
        ret += 'L';
        is_first_async = false;
      }
      ret += toMultiToss(siteswap[beat]);
      last_throw_was_l = true;
    } else if (siteswap[beat+1] !== undefined) {
      // right only.
      if (!last_throw_was_l || is_first_async) {
        ret += 'R';
        is_first_async = false;
      }
      last_throw_was_l = false;
      ret += toMultiToss(siteswap[beat+1]);
    } else {
      // no throws.
      ret += 0;
      last_throw_was_l = !last_throw_was_l;
      is_first_async = false;
    }
  }
  return ret + (star ? '*' : '');
}

////////////////////////////////////////////////////////////
// Utilities for translating cards to enumerate siteswaps //
////////////////////////////////////////////////////////////

// handles a multiplex card at height 'accum' and returns the new accum
function handleCard(card, accum) {
  for (let card_entry of card) {
    if (card_entry >= accum) {
      accum -= 1;
    }
  }
  return accum;
}

function convertCards(cards) {
  var ret = [];
  // handle each card one by one
  for (var i = 0; i < cards.length; i++) {
    var translated_card = [];
    for (let toss of cards[i]) {
      var accum = toss;
      var steps = 0;
      var card_index = (i+1) % cards.length;
      while (accum > 0) {
        accum = handleCard(cards[card_index], accum);
        steps += 1;
        card_index = (card_index + 1) % cards.length;
      }
      translated_card.push(steps);
    }
    ret.push(translated_card);
  }
  return ret;
}

function int_to_card(i) {
  let ret = [];
  let bit_idx = 0;
  let mask = 1;
  while (i >= mask) {
    if ((i & mask) !== 0) {
      ret.push(bit_idx + 1);
    }
    bit_idx += 1;
    mask *= 2;
  }
  ret.sort(function(a, b){return b-a;});
  return ret;
}

/////////////////////////////
// relates to random cards //
/////////////////////////////

// should probably check that num_balls is positive or something.
function build_deck(allow_zeros,  max_multiplicity, num_balls) {
  let ret = [];

  if (allow_zeros) {
    ret.push([0]);
  }

  let num_cards = 2 ** num_balls;
  for (let i = 1; i < num_cards; i++) {
    let card = int_to_card(i);
    if (card.length <= max_multiplicity) {
      ret.push(card);
    }
  }

  return ret;
}

// checks if hand actually has num_balls.
function worth_translating(hand, num_balls) {
  for (let card of hand) {
    if (card[0] == num_balls) {
      return true;
    }
  }
  return false;
}

function contains_0x(siteswap) {
  for (let i = 0; i < siteswap.length; i++) {
    let beat = siteswap[i];
    if (beat !== undefined) {
      for (let toss of beat) {
        if (toss.height === 0 && toss.x === true) {
          return true;
        }
      }
    }
  }
  return false;
}

function check_max_height(siteswap, max) {
  for (let i = 0; i < siteswap.length; i++) {
    let beat = siteswap[i];
    if (beat !== undefined) {
      for (let toss of beat) {
        if (toss.height > max) {
          return false;
        }
      }
    }
  }
  return true;
}

function contains_trivial_multiplex(siteswap) {
  for (let i = 0; i < siteswap.length; i++) {
    let beat = siteswap[i];
    if (beat !== undefined && beat.length > 1) {
      for (let toss of beat) {
        if ((toss.height == 2 && !toss.x) || (toss.height === 1 && toss.x)) {
          return true;
        }
      }
    }
  }
  return false;
}

function contains_squeeze(siteswap, len) {
  let landings = [];
  for (let i = 0; i < siteswap.length; i++) {
    let beat = siteswap[i];
    if (beat !== undefined) {
      for (let toss of beat) {
        let landing = i + (2 * toss.height);
        if ((toss.height + (toss.x ? 1 : 0)) % 2 !== 0) {
          if (i % 2 === 0) {
            landing += 1;
          } else {
            landing -= 1;
          }
        }
        landing %= len;
        if (landings[landing] === undefined) {
          landings[landing] = [];
        }
        landings[landing].push(toss);
      }
    }
  }

  for (let i = 0; i < landings.length; i++) {
    let beat = landings[i];
    let nontrival = 0;
    if (beat !== undefined && beat.length > 1) {
      for (let toss of beat) {
        if (!((toss.height == 2 && !toss.x) || (toss.height === 1 && toss.x))) {
          nontrival += 1;
        }
      }
    }
    if (nontrival > 1) {
      return true;
    }
  }

  return false;
}

function matches_filters(siteswap, len, filters) {
  // contains 0x
  if (contains_0x(siteswap)) {
    return false;
  }

  // max height
  if (filters.max_height !== undefined && 
    !check_max_height(siteswap, filters.max_height)) {
    return false;
  }


  // trivial multiplexes
  if (filters.reject_trivial_multiplexes && contains_trivial_multiplex(siteswap)) {
    return false;
  }

  // squeeze catches
  if (filters.reject_squeezes && contains_squeeze(siteswap, len)) {
    return false;
  }

  // TODO(jmerm): max multiplex split

  return true;
}

function get_n_siteswaps(allow_zeros, max_multiplicity, num_balls, beats,
  period, star, filters, num_to_print) {
  
  // We shuffle the deck to add randomness when only printing a subset of the
  // possibilities.
  let deck = build_deck(allow_zeros, max_multiplicity, num_balls);
  shuffleArray(deck);
  let seen = new Set();
  for (let i = 0; i < deck.length**beats.length ; i++) {
    let hand = []
    let copy = i;
    for (let j = 0; j < beats.length; j++) {
      hand.push(deck[copy % deck.length]);
      copy = (copy/deck.length|0);
    }
    if (worth_translating(hand, num_balls)) {
      let siteswap = convertCards(hand);
      let translated = translate_siteswap(siteswap, beats, period, star);
      if (matches_filters(translated, period, filters)) {
        seen.add(print_siteswap(translated, period, star));
      }
      if (seen.size >= num_to_print) {
        return seen;
      }
    }
  }
  return seen;
}

function parse_list(l) {
  let ret = [];
  for (let s of l.split(',')) {
    ret.push(parseInt(s));
  }
  return ret;
}

// main.

// let period = 12;
// let beats = [0,1,5,6,9];
// let star = false;
// 
// let max_multiplicity = 1;
// let num_balls = 4;
// let num_to_print = 25;
// let allow_zeros = false;
// 
// let filters = {
//   max_height : 8,
//   reject_trivial_multiplexes : false,
// }
// 
// for (let siteswap of get_n_siteswaps(allow_zeros, max_multiplicity,
//   num_balls, beats, period, star, filters, num_to_print)) {
//   console.log(siteswap);
// }
