import { api } from './api.js';

const reminders = '/api/v1/reminders';
const subscription = '/api/v1/push/subscription';

export const getReminders = () => api(reminders);
export const saveReminders = (list, pauseDays) => api(reminders, {
  method: 'PUT', body: { reminders: list, ...(pauseDays === undefined ? {} : { pause_days: pauseDays }) },
});
export const registerPush = (browserSubscription) => api(subscription, { method: 'POST', body: browserSubscription.toJSON() });
export const unregisterPush = (endpoint) => api(subscription, { method: 'DELETE', body: { endpoint } });
