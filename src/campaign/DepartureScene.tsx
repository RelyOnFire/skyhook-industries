import LaunchViewport from './LaunchViewport.js';
import { earthDepartureWorld } from './earthDepartureWorld.js';
import DepartureDiagram from './DepartureDiagram.js';

export default function DepartureScene(props:{stage:number;progress:number}){
  return <LaunchViewport {...props} build={earthDepartureWorld} fallback={<DepartureDiagram {...props}/>}/>;
}
