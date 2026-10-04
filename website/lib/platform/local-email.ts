/**
 * Local email sink.
 *
 * Development and test transport for the email port. No live provider is
 * activated in this slice: the message is handed to an in-memory collector, and
 * optionally to a development-only capture file.
 *
 * The capture file exists because a passwordless flow is unusable in development
 * without a way to read the delivered link — it is the local equivalent of a mail
 * catcher, not an application log. It is ignored entirely in production (see
 * `loadPlatformConfig`), it is opt-in, and nothing here writes to stdout or to the
 * database.
 */

import { appendFileSync } from "node:fs";

import type { EmailDelivery, SignInMessage } from "./ports";

export interface RecordedSignInMessage {
  to: string;
  signInUrl: string;
  expiresAt: number;
}

export interface LocalEmailSinkOptions {
  /**
   * Path for the development mail log. Null (the default) keeps delivery entirely
   * in memory. The file holds live sign-in links, so it must live somewhere
   * ignored by version control — `.local/` is.
   */
  recordPath?: string | null;
}

export class LocalEmailSink implements EmailDelivery {
  private readonly messages: RecordedSignInMessage[] = [];
  private readonly recordPath: string | null;

  constructor(options: LocalEmailSinkOptions = {}) {
    this.recordPath = options.recordPath ?? null;
  }

  async sendSignInLink(message: SignInMessage): Promise<void> {
    const recorded: RecordedSignInMessage = {
      to: message.to,
      signInUrl: message.signInUrl,
      expiresAt: message.expiresAt,
    };
    this.messages.push(recorded);

    if (this.recordPath) {
      // One JSON object per line, owner-readable only: the sign-in link inside it
      // is a usable credential until it is consumed or expires.
      appendFileSync(this.recordPath, `${JSON.stringify(recorded)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
    }
  }

  /** Dev/test accessor for the last message sent to an address. */
  lastMessageTo(to: string): RecordedSignInMessage | undefined {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      if (this.messages[index]!.to === to) {
        return this.messages[index];
      }
    }
    return undefined;
  }

  get messageCount(): number {
    return this.messages.length;
  }
}