import {useState} from 'react';
import NewProfitSample,{Sankey,Waterfall} from './new-profit';
import {NewProfitLive} from '../components/NewProfitLive';
/** Authenticated route only; the independent design demo imports no live reader. */
export default function NewProfitConnected(){
 const [sample,setSample]=useState(false);
 return sample?<NewProfitSample showLinked={()=>setSample(false)}/>:<NewProfitLive showSample={()=>setSample(true)} renderSankey={(values,perOrder)=><Sankey values={values} perOrder={perOrder} linked/>} renderWaterfall={(steps,perOrder)=><Waterfall steps={steps} perOrder={perOrder} title="Linked monthly profit change bridge"/>}/>;
}
