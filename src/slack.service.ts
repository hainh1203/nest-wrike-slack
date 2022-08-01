import { Injectable } from '@nestjs/common'
import { App } from '@slack/bolt'
import { ConfigService } from '@nestjs/config'
import { SlackIdsInterface } from './slack-ids.interface'

@Injectable()
export class SlackService {
  private app

  constructor(private configService: ConfigService) {
    if (
      !this.configService.get('slack_bot_token') ||
      !this.configService.get('slack_signing_secret')
    ) {
      throw 'token and signing secret cannot be empty'
    }
    this.app = new App({
      token: this.configService.get('slack_bot_token'),
      signingSecret: this.configService.get('slack_signing_secret'),
    })
  }

  public async getSlackIds(): Promise<SlackIdsInterface> {
    console.log('getSlackIds...')
    const users = await this.app.client.users.list()
    const slackIds: SlackIdsInterface = {}

    users.members.forEach((member) => {
      if (
        member.is_bot ||
        member.deleted ||
        this.configService.get<string[]>('ignore').includes(member.name)
      )
        return

      slackIds[member.name] = member.id
    })

    return slackIds
  }
}
