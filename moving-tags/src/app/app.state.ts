import { Item } from './models/data.models';

export interface AppState {
  items: Item[];
  selectedId: string | null;
  tab: 'list' | 'edit';
}

export const initialAppState: AppState = {
  items: [],
  selectedId: null,
  tab: 'list',
};
