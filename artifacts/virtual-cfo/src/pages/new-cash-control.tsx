import {useState} from 'react';
import CashDemo from './cash-demo';
import NewCashLinked from './new-cash-linked';

/** Signed-in New Cash entry; standalone demo never imports live infrastructure. */
export default function NewCashControl(){
 const [sample,setSample]=useState(false);
 return sample?<CashDemo review onBack={()=>setSample(false)}/>:<NewCashLinked onSample={()=>setSample(true)}/>;
}
