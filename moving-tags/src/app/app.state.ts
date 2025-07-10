import { Item } from './models/data.models';

//FIXME use model definition

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
