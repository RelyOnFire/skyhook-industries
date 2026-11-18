import LaunchViewport from './LaunchViewport.js';
import { lunarDepartureWorld } from './lunarDepartureWorld.js';
import LunarDepartureDiagram from './LunarDepartureDiagram.js';

export default function LunarDepartureScene(props:{stage:number;progress:number}){
  return <LaunchViewport {...props} build={lunarDepartureWorld} fallback={<LunarDepartureDiagram {...props}/>}/>;
}
