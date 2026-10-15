import {createContext,useContext} from 'react';
export type DemoPage='profit'|'cash';
export const DemoNavigation=createContext<DemoPage>('profit');
export const useDemoPage=()=>useContext(DemoNavigation);
