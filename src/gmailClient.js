import { google } from 'googleapis';
import { HistoryExpiredError } from './sync.js';

export function createGmailClient({ clientId, clientSecret, refreshToken, labelId, topicName }) {
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  const users = google.gmail({ version: 'v1', auth }).users;

  return {
    async listHistory(startHistoryId) {
      const ids = new Set();
      let pageToken;
      let historyId = startHistoryId;
      try {
        do {
          const { data } = await users.history.list({
            userId: 'me',
            startHistoryId,
            labelId,
            historyTypes: ['messageAdded', 'labelAdded'],
            pageToken,
          });
          for (const h of data.history ?? []) {
            for (const m of [...(h.messagesAdded ?? []), ...(h.labelsAdded ?? [])]) ids.add(m.message.id);
          }
          if (data.historyId) historyId = data.historyId;
          pageToken = data.nextPageToken;
        } while (pageToken);
      } catch (e) {
        if (e.code === 404 || e.status === 404) throw new HistoryExpiredError();
        throw e;
      }
      return { messageIds: [...ids], historyId };
    },

    async listMessages(query) {
      const ids = [];
      let pageToken;
      do {
        const { data } = await users.messages.list({ userId: 'me', q: query, pageToken });
        ids.push(...(data.messages ?? []).map((m) => m.id));
        pageToken = data.nextPageToken;
      } while (pageToken);
      return ids;
    },

    async getMessage(id) {
      const { data } = await users.messages.get({ userId: 'me', id, format: 'full' });
      return data;
    },

    async startWatch() {
      const { data } = await users.watch({
        userId: 'me',
        requestBody: { topicName, labelIds: [labelId], labelFilterBehavior: 'INCLUDE' },
      });
      return { historyId: String(data.historyId) };
    },
  };
}
