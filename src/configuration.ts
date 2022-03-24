export default () => ({
  token: process.env.WRIKE_TOKEN,
  webhook: process.env.SLACK_WEBHOOK,
  icon_ok: ':white_check_mark:',
  icon_warning: ':sos:',
  minimum_time: 6,
  maximum_time: 10,
  suffix_mail: '@cryptopie-labo.com',
  emails: ['nguyenhonghai@cryptopie-labo.com'],
})
