"""Independent DOP853 reference for the D1p conservative-coast fixture.
Run: python analysis/lab_reference.py > tests/fixtures/lab-coast.json
Needs NumPy/SciPy, intentionally not part of the browser runtime.
This validates a numerical implementation, not a flexible flight structure.
"""
import json
import numpy as np
from scipy.integrate import solve_ivp
mu, radius, length, density, area = 3.986004418e14, 6371000.0, 600000.0, 1560.0, 80e-6
positions = np.r_[np.linspace(-length/2+length/96, length/2-length/96, 48), -length/2, 0.0, length/2]
masses = np.r_[np.full(48,density*area*length/48), 2000.0, 50000.0, 2000.0]
com = np.sum(masses*positions)/np.sum(masses)
positions -= com
inertia = np.sum(masses*positions**2)

def rhs(t,y):
    axis=np.array([np.cos(y[4]),np.sin(y[4])])
    r=y[:2]+positions[:,None]*axis
    force=-mu*masses[:,None]*r/(np.linalg.norm(r,axis=1)**3)[:,None]
    acc=np.sum(force,axis=0)/np.sum(masses)
    torque=np.sum(positions*(axis[0]*force[:,1]-axis[1]*force[:,0]))
    return [y[2],y[3],acc[0],acc[1],y[5],torque/inertia]

r=radius+1600000.0
initial=[r,0,0,np.sqrt(mu/r),np.pi,1200/(length/2)]
solution=solve_ivp(rhs,[0,7200],initial,method='DOP853',rtol=2e-12,atol=[1e-6,1e-6,1e-9,1e-9,1e-13,1e-14],max_step=5)
assert solution.success
print(json.dumps({'method':'SciPy DOP853; 48 mass cells; initial fuel 20 t; coast 7200 s','duration':7200,'state':solution.y[:,-1].tolist()},indent=2))
