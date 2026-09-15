"""Independent DOP853 reference for the G1 asymmetric coast equations.
Regenerate: python3 analysis/geometry_reference.py > tests/fixtures/geometry-reference.json
Requires NumPy/SciPy. No TypeScript engine or exported engine states are used.
"""
import json
import numpy as np
from scipy.integrate import solve_ivp
mu=3.986004418e14;earth=6371000.
la,lb=100000.,400000.;area=120e-6;rho=1560.;na,nb=10,38
s=np.concatenate([np.linspace(-la+la/na/2,-la/na/2,na),np.linspace(lb/nb/2,lb-lb/nb/2,nb),[-la,0,lb]])
m=np.concatenate([np.full(na,rho*area*la/na),np.full(nb,rho*area*lb/nb),[40000,30000,2000]])
M=m.sum();center=(m*s).sum()/M;q=s-center;I=(m*q*q).sum()
rp,ra=earth+1500000,earth+6000000;a=(rp+ra)/2;e=(ra-rp)/(ra+rp);p=a*(1-e*e)
nu=np.radians(35);theta=nu+np.radians(107);r=p/(1+e*np.cos(nu));v=np.sqrt(mu/p)
y0=[r*np.cos(nu),r*np.sin(nu),-v*np.sin(nu),v*(e+np.cos(nu)),theta,2*np.pi/(40*60)]
def derivative(t,y):
    x,z,vx,vz,theta,w=y;u=np.array([np.cos(theta),np.sin(theta)])
    positions=np.array([x,z])[:,None]+u[:,None]*q
    force=-mu*positions/np.linalg.norm(positions,axis=0)**3*m
    net=force.sum(axis=1);torque=(q*(u[0]*force[1]-u[1]*force[0])).sum()
    return [vx,vz,net[0]/M,net[1]/M,w,torque/I]
solution=solve_ivp(derivative,[0,1200],y0,method='DOP853',rtol=2e-13,atol=[1e-7,1e-7,1e-10,1e-10,1e-13,1e-14],max_step=2)
assert solution.success
print(json.dumps({'method':'independent SciPy DOP853','time':1200,'cells':48,'designChanges':{'anomalyDeg':35,'attitudeDeg':107},'initial':y0,'final':solution.y[:,-1].tolist()},indent=2))
