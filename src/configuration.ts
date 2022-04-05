export default () => ({
  token: process.env.WRIKE_TOKEN,
  google_sheet_api: process.env.GOOGLE_SHEET_API,
  icon_ok: ':white_check_mark:',
  icon_warning: ':sos:',
  minimum_time: 6,
  maximum_time: 10,
  suffix_mail: '@cryptopie-labo.com',
})
