import React, {Dispatch} from 'react';
import mainReducer, {RootState, Actions} from 'reducers';

const defaultState: RootState = mainReducer();

const defaultContext: [RootState, Dispatch<Actions>] = [defaultState, () => {}];
export const StateContext = React.createContext(defaultContext);

export const StateProvider: React.FC<Props> = ({children}: Props) => (
  <StateContext.Provider value={React.useReducer(mainReducer, defaultState)}>
    {children}
  </StateContext.Provider>
);
interface Props {
  children: React.ReactNode;
}

export const useRootState = () => React.useContext(StateContext);
