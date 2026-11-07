import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import NewProfit from '../pages/new-profit';
import CashDemo from '../pages/cash-demo';
import {DemoNavigation,type DemoPage} from './DemoNavigation';
import '../index.css';
import './demo.css';
function App(){
 const [page,setPage]=useState<DemoPage>(()=>window.location.hash==='#/cash-control'?'cash':'profit');
 useEffect(()=>{const navigate=()=>{if(window.location.hash==='#/cash-control')setPage('cash');if(window.location.hash==='#/profit-engine')setPage('profit');};window.addEventListener('hashchange',navigate);return()=>window.removeEventListener('hashchange',navigate);},[]);
 useEffect(()=>{document.title=`Night Scout Demo · ${page==='cash'?'Cash Control':'Profit Engine'}`;window.scrollTo(0,0);},[page]);
 return <DemoNavigation value={page}>{page==='cash'?<CashDemo/>:<NewProfit demo/>}</DemoNavigation>;
}
createRoot(document.getElementById('root')!).render(<App/>);
