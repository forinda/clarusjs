// The emoji the composer suggests after ":", loaded on first use (its own chunk). Common ones, by their usual
// shortcodes (GitHub's and Slack's names).
// ponytail: about a hundred common emoji, not the full Unicode set; an app with its own list passes its own search.
export const emoji: { id: string; label: string; char: string }[] = ([
  ['smile', '😄'], ['grin', '😁'], ['joy', '😂'], ['rofl', '🤣'], ['smiley', '😃'], ['sweat_smile', '😅'], ['laughing', '😆'],
  ['wink', '😉'], ['blush', '😊'], ['innocent', '😇'], ['slightly_smiling_face', '🙂'], ['upside_down_face', '🙃'],
  ['heart_eyes', '😍'], ['star_struck', '🤩'], ['kissing_heart', '😘'], ['yum', '😋'], ['stuck_out_tongue', '😛'],
  ['zany_face', '🤪'], ['thinking', '🤔'], ['shushing_face', '🤫'], ['raised_eyebrow', '🤨'], ['neutral_face', '😐'],
  ['expressionless', '😑'], ['no_mouth', '😶'], ['smirk', '😏'], ['unamused', '😒'], ['roll_eyes', '🙄'], ['grimacing', '😬'],
  ['relieved', '😌'], ['pensive', '😔'], ['sleepy', '😪'], ['sleeping', '😴'], ['mask', '😷'], ['nerd_face', '🤓'],
  ['sunglasses', '😎'], ['partying_face', '🥳'], ['confused', '😕'], ['worried', '😟'], ['frowning', '☹️'],
  ['open_mouth', '😮'], ['astonished', '😲'], ['flushed', '😳'], ['pleading_face', '🥺'], ['cry', '😢'], ['sob', '😭'],
  ['scream', '😱'], ['angry', '😠'], ['rage', '😡'], ['skull', '💀'], ['poop', '💩'], ['clown_face', '🤡'], ['ghost', '👻'],
  ['robot', '🤖'], ['wave', '👋'], ['ok_hand', '👌'], ['v', '✌️'], ['crossed_fingers', '🤞'], ['point_up', '☝️'],
  ['point_down', '👇'], ['thumbsup', '👍'], ['+1', '👍'], ['thumbsdown', '👎'], ['-1', '👎'], ['clap', '👏'],
  ['raised_hands', '🙌'], ['pray', '🙏'], ['muscle', '💪'], ['eyes', '👀'], ['brain', '🧠'], ['heart', '❤️'],
  ['orange_heart', '🧡'], ['yellow_heart', '💛'], ['green_heart', '💚'], ['blue_heart', '💙'], ['purple_heart', '💜'],
  ['broken_heart', '💔'], ['sparkling_heart', '💖'], ['100', '💯'], ['fire', '🔥'], ['sparkles', '✨'], ['star', '⭐'],
  ['zap', '⚡'], ['boom', '💥'], ['tada', '🎉'], ['confetti_ball', '🎊'], ['gift', '🎁'], ['trophy', '🏆'], ['rocket', '🚀'],
  ['bulb', '💡'], ['warning', '⚠️'], ['x', '❌'], ['white_check_mark', '✅'], ['heavy_check_mark', '✔️'], ['question', '❓'],
  ['exclamation', '❗'], ['bug', '🐛'], ['lock', '🔒'], ['key', '🔑'], ['hammer', '🔨'], ['wrench', '🔧'], ['gear', '⚙️'],
  ['memo', '📝'], ['pushpin', '📌'], ['link', '🔗'], ['calendar', '📅'], ['hourglass', '⌛'], ['coffee', '☕'], ['pizza', '🍕'],
  ['beers', '🍻'], ['cake', '🍰'], ['sun', '☀️'], ['rainbow', '🌈'], ['seedling', '🌱'], ['dog', '🐶'], ['cat', '🐱'],
  ['see_no_evil', '🙈'], ['party_popper', '🎉'], ['money_bag', '💰'], ['chart_with_upwards_trend', '📈'], ['ship', '🚢'],
] as const).map(([label, char]) => ({ id: label, label, char }))
