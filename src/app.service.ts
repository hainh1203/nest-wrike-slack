import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { lastValueFrom } from 'rxjs'
import { TicketInterface } from './ticket.interface'
import { ConfigService } from '@nestjs/config'
import { MemberInterface } from './member.interface'
import { Cron } from '@nestjs/schedule'
import { SlackService } from './slack.service'
import { SlackIdsInterface } from './slack-ids.interface'

// https://developers.wrike.com/api/v4/timelogs
@Injectable()
export class AppService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private slackService: SlackService,
  ) {}

  @Cron('0 0 23 * * 1-5', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }) // 23h00 T2 -> t6
  public async reportTimeLog(): Promise<void> {
    if (
      !this.configService.get('token') ||
      !this.configService.get('google_sheet_api')
    ) {
      console.log('token and webhook cannot be empty')
      return
    }

    const timeLogs: [] = await this.getTimeLogs()
    const timeLogsByUserId = this.groupTimeLogByUserId(timeLogs)
    const timeLogsByEmail = await this.replaceUserIdAndTicketId(
      timeLogsByUserId,
    )

    const members: MemberInterface[] = await this.getMembers()
    const slackIds: SlackIdsInterface = await this.slackService.getSlackIds()

    members.forEach((member: MemberInterface): void => {
      const slackName: string = member.email.replace(
        this.configService.get('suffix_mail'),
        '',
      )
      const mention: string = slackIds[slackName] || slackName

      this.sendMessageToSlack(
        member.webhook,
        this.makeMessage(
          timeLogsByEmail,
          member.email,
          mention,
          member.show_detail,
        ),
      )
    })
  }

  async getTimeLogs(): Promise<[]> {
    console.log('getTimeLogs...')

    const api = 'https://www.wrike.com/api/v4/timelogs'

    try {
      const currentDate = new Date().toISOString().slice(0, 10)

      const response = await lastValueFrom(
        this.httpService.get(api + `?trackedDate={"equal":${currentDate}}`, {
          headers: {
            Authorization: 'bearer ' + this.configService.get('token'),
          },
        }),
      )

      return response.data.data
    } catch (e) {
      console.log('getTimeLogs -> retry')
      await this.sleep(1000)
      return await this.getTimeLogs()
    }
  }

  async getMembers(): Promise<MemberInterface[]> {
    console.log('getMembers...')

    const api = this.configService.get('google_sheet_api')

    try {
      const response = await lastValueFrom(this.httpService.get(api))

      return response.data.content
    } catch (e) {
      return []
    }
  }

  private groupTimeLogByUserId(timeLogs): any {
    const timeLogsByUserId = {}

    timeLogs.forEach((timeLog) => {
      if (timeLogsByUserId.hasOwnProperty(timeLog.userId)) {
        if (timeLogsByUserId[timeLog.userId].hasOwnProperty(timeLog.taskId)) {
          // merge ticket same id
          timeLogsByUserId[timeLog.userId][timeLog.taskId] += timeLog.hours
        } else {
          timeLogsByUserId[timeLog.userId][timeLog.taskId] = timeLog.hours
        }
      } else {
        timeLogsByUserId[timeLog.userId] = { [timeLog.taskId]: timeLog.hours }
      }
    })

    return timeLogsByUserId
  }

  private async replaceUserIdAndTicketId(timeLogsByUserId): Promise<any> {
    const promises = []

    for (const userId in timeLogsByUserId) {
      promises.push(
        this.mapUserEmailAndTicketTitle(userId, timeLogsByUserId[userId]),
      )
    }

    const resultArray: Awaited<any>[] = await Promise.all(promises)

    return Object.assign({}, ...resultArray)
  }

  private async mapUserEmailAndTicketTitle(
    userId: string,
    ticketsByTicketId,
  ): Promise<any> {
    const user = await this.getUserById(userId)

    const promises = []

    for (const ticketId in ticketsByTicketId) {
      promises.push(this.mapTicketTitle(ticketId, ticketsByTicketId[ticketId]))
    }

    const tickets: Awaited<TicketInterface>[] = await Promise.all(promises)

    return { [user.profiles[0].email]: tickets }
  }

  private async mapTicketTitle(
    ticketId: string,
    spentTime: number,
  ): Promise<TicketInterface> {
    const ticket = await this.getTicketById(ticketId)

    return {
      title: ticket.title,
      spentTime: spentTime,
    }
  }

  private async getUserById(userId: string): Promise<any> {
    const api = 'https://www.wrike.com/api/v4/users/'

    try {
      const response = await lastValueFrom(
        this.httpService.get(api + userId, {
          headers: {
            Authorization: 'bearer ' + this.configService.get('token'),
          },
        }),
      )

      return response.data.data[0]
    } catch (e) {
      console.log(`getUserById: ${userId} -> retry`)
      await this.sleep(1000)
      return await this.getUserById(userId)
    }
  }

  async getTicketById(ticketId: string): Promise<any> {
    const api = 'https://www.wrike.com/api/v4/tasks/'

    try {
      const response = await lastValueFrom(
        this.httpService.get(api + ticketId, {
          headers: {
            Authorization: 'bearer ' + this.configService.get('token'),
          },
        }),
      )

      return response.data.data[0]
    } catch (e) {
      console.log(`getTicketById: ${ticketId} -> retry`)
      await this.sleep(1000)
      return await this.getTicketById(ticketId)
    }
  }

  async sendMessageToSlack(webhook: string, messages: []): Promise<void> {
    if (!messages.length) return

    await lastValueFrom(
      this.httpService.post(
        webhook,
        {
          blocks: messages,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )
  }

  makeMessage(
    timeLogs,
    email: string,
    mention: string,
    showDetail: number,
  ): [] {
    let messages: any = []

    if (!timeLogs.hasOwnProperty(email)) {
      messages = messages.concat([
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `${mention} ${this.configService.get('icon_warning')}`,
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: '*Tickets* (0)',
            },
            {
              type: 'mrkdwn',
              text: '*Spent Time* (0h)',
            },
          ],
        },
      ])
    } else {
      const tickets: TicketInterface[] = timeLogs[email]

      const totalSpentTime: number = this.sumSpentTime(tickets)

      const icon: string =
        totalSpentTime >= this.configService.get('minimum_time') &&
        totalSpentTime <= this.configService.get('maximum_time')
          ? this.configService.get('icon_ok')
          : this.configService.get('icon_warning')

      messages = messages.concat([
        {
          type: 'divider',
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `${mention} ${icon}`,
            },
          ],
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Tickets* (${tickets.length})`,
            },
            {
              type: 'mrkdwn',
              text: `*Spent Time* (${totalSpentTime}h)`,
            },
          ],
        },
      ])

      if (showDetail) {
        tickets.forEach((ticket: TicketInterface): void => {
          messages.push({
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: ticket.title,
              },
              {
                type: 'mrkdwn',
                text: `${ticket.spentTime}h`,
              },
            ],
          })
        })
      }
    }

    return messages
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private sumSpentTime(tickets: TicketInterface[]): number {
    return tickets.reduce(
      (a: number, b: TicketInterface) => a + (b.spentTime || 0),
      0,
    )
  }
}
