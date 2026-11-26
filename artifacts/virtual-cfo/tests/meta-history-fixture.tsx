import React from 'react';
import {createRoot} from 'react-dom/client';
import {MetaSavedHistory,MetaSavedHistoryFromWire} from '../src/components/MetaSavedHistory';
import {fixtureProps} from './meta-history.fixture';
import {wireFixture} from './meta-history-wire.fixture';
import './meta-history-fixture.css';
const scenario=new URLSearchParams(location.search).get('scenario')||'current';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:960,margin:'0 auto',padding:16}}><h1>Disposable Meta history fixture — not live</h1>{scenario.startsWith('wire-')?<MetaSavedHistoryFromWire {...wireFixture(scenario)}/>:<MetaSavedHistory {...fixtureProps(scenario)}/>}</main>);
