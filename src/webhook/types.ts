/* eslint-disable @typescript-eslint/ban-types */

type Hooks = {
	[key: string]: Function[];
};

export interface State {
	hooks: Hooks;
}

export interface WebhookEvent  {
	id: string;
	name: string;
	payload: any;
	signature: string;
  }