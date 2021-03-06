export default () => ({
  token: process.env.WRIKE_TOKEN,
  google_sheet_api: process.env.GOOGLE_SHEET_API,
  slack_bot_token: process.env.SLACK_BOT_TOKEN,
  slack_signing_secret: process.env.SLACK_SIGNING_SECRET,
  icon_ok: ':white_check_mark:',
  icon_warning: ':sos:',
  minimum_time: 8,
  maximum_time: 15,
  suffix_mail: '@cryptopie-labo.com',
  slack_webhook_all: process.env.SLACK_WEBHOOK_ALL,
  ignore: process.env.IGNORE.split(','),
})
