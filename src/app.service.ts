import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { lastValueFrom } from 'rxjs'
import { TicketInterface } from './ticket.interface'
import { ConfigService } from '@nestjs/config'

// https://developers.wrike.com/api/v4/timelogs
@Injectable()
export class AppService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    if (
      !this.configService.get('token') ||
      !this.configService.get('webhook')
    ) {
      console.log('token and webhook cannot be empty')
      return
    }

    this.reportTimeLog()
  }

  public async reportTimeLog(): Promise<void> {
    const timeLogs: [] = await this.getTimeLogs()
    const timeLogsByUserId = this.groupTimeLogByUserId(timeLogs)
    const timeLogsByEmail = await this.replaceUserIdAndTicketId(
      timeLogsByUserId,
    )

    const emails: string[] = this.configService.get('emails')

    emails.forEach((email: string): void => {
      this.sendMessageToSlack(
        this.configService.get('webhook'),
        this.makeMessage(timeLogsByEmail, email),
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

  makeMessage(timeLogs, email: string): [] {
    let messages: any = []

    if (!timeLogs.hasOwnProperty(email)) {
      messages = messages.concat([
        {
          type: 'divider',
        },
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${email.replace(
              this.configService.get('suffix_mail'),
              '',
            )} ${this.configService.get('icon_warning')}`,
            emoji: true,
          },
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

      const totalSpentTime = this.sumSpentTime(tickets)

      const icon: string =
        totalSpentTime > this.configService.get('minimum_time') &&
        totalSpentTime < this.configService.get('maximum_time')
          ? this.configService.get('icon_ok')
          : this.configService.get('icon_warning')

      messages = messages.concat([
        {
          type: 'divider',
        },
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${email.replace(
              this.configService.get('suffix_mail'),
              '',
            )} ${icon}`,
            emoji: true,
          },
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
