# Generates the sample 360 panorama (equirectangular). Run from the project root: python3 scripts/generate-sample-panorama.py (needs numpy + Pillow; optional - the image is already included).
import numpy as np
from PIL import Image
W,H=4096,2048
u=(np.arange(W)+.5)/W; v=(np.arange(H)+.5)/H
lon=(u*2*np.pi-np.pi)[None,:]; lat=(np.pi/2-v*np.pi)[:,None]
dx=(np.cos(lat)*np.sin(lon)).astype(np.float32)*np.ones((1,W),np.float32)
dy=(np.sin(lat)*np.ones((1,W))).astype(np.float32)
dz=(np.cos(lat)*np.cos(lon)).astype(np.float32)
eps=1e-6
cam=np.array([0.0,1.45,0.0],np.float32)
RX,RY,RZ=3.2,2.8,2.6   # room x:[-RX,RX], y:[0,RY], z:[-RZ,RZ]
def stripe(c,w,a=.12,seed=1):
    i=np.floor(c/w); h=(np.sin(i*12.9898+seed*78.233)*43758.5453)%1
    f=(c/w)-i
    return 1-a*h-(f<.04)*.25
# room intersection
def tpl(p,d):
    with np.errstate(divide='ignore',invalid='ignore'):
        return np.where(np.abs(d)>eps,(p)/d,np.inf)
tx=np.where(dx>0,(RX-cam[0])/np.where(dx==0,eps,dx),(-RX-cam[0])/np.where(dx==0,eps,dx))
ty=np.where(dy>0,(RY-cam[1])/np.where(dy==0,eps,dy),(-cam[1])/np.where(dy==0,eps,dy))
tz=np.where(dz>0,(RZ-cam[2])/np.where(dz==0,eps,dz),(-RZ-cam[2])/np.where(dz==0,eps,dz))
t=np.minimum(np.minimum(tx,ty),tz)
px=cam[0]+dx*t; py=cam[1]+dy*t; pz=cam[2]+dz*t
col=np.zeros((H,W,3),np.float32)
def setc(mask,rgb):
    for k in range(3): col[...,k]=np.where(mask,rgb[k] if np.isscalar(rgb[k]) else rgb[k],col[...,k])
floor=(ty==t)&(dy<0); ceil=(ty==t)&(dy>0)
wallx=(tx==t); wallz=(tz==t)
cream=np.array([.93,.90,.84],np.float32)
# walls base
for k in range(3): col[...,k]=cream[k]
# accent wall -X green
acc=wallx&(dx<0)
for k,c in enumerate([.46,.60,.52]): col[...,k]=np.where(acc,c,col[...,k])
# floor planks
pl=stripe(px,.20,.14,3)*np.where(((np.floor(pz/1.1))%2)==0,1,.97)
wood=np.array([.60,.41,.24],np.float32)
for k in range(3): col[...,k]=np.where(floor,wood[k]*pl,col[...,k])
# rug
rug=floor&(px>-1.9)&(px<.9)&(pz>-1.25)&(pz<1.25)
rb=np.array([.78,.70,.58],np.float32); rr=np.array([.30,.45,.50],np.float32)
border=((px>-1.75)&(px<.75)&(pz>-1.1)&(pz<1.1))
for k in range(3): col[...,k]=np.where(rug,np.where(border,rr[k],rb[k]),col[...,k])
# ceiling
for k in range(3): col[...,k]=np.where(ceil,.97,col[...,k])
light=ceil&(px**2+pz**2<.45**2)
for k in range(3): col[...,k]=np.where(light,1.2,col[...,k])
emit=np.zeros((H,W),bool)
# windows on +Z wall
wz=wallz&(dz>0)
for x0,x1 in [(-2.2,-.5),(.5,2.2)]:
    m=wz&(px>x0)&(px<x1)&(py>.9)&(py<2.35)
    fr=m&((px<x0+.07)|(px>x1-.07)|(py<.97)|(py>2.28)|(np.abs(px-(x0+x1)/2)<.03))
    sky=np.stack([.70+.25*(py-.9)/1.5,.84+.12*(py-.9)/1.5,np.ones_like(py)],-1)
    col=np.where((m&~fr)[...,None],sky*1.15,col); emit|=(m&~fr)
    col=np.where(fr[...,None],np.array([.95,.95,.93],np.float32),col)
# door on -Z wall
wn=wallz&(dz<0)
door=wn&(px>-.5)&(px<.5)&(py<2.15)
dw=np.array([.45,.30,.18],np.float32)*(0.9+.1*np.sin(px*40))[...,None]
col=np.where(door[...,None],dw,col)
knob=wn&((px-.38)**2+(py-1.0)**2<.04**2); col=np.where(knob[...,None],np.array([.85,.75,.4],np.float32),col)
# framed art on +X wall
wp=wallx&(dx>0)
art=wp&(pz>-.9)&(pz<.9)&(py>1.3)&(py<2.1)
inner=art&(pz>-.82)&(pz<.82)&(py>1.38)&(py<2.02)
col=np.where(art[...,None],np.array([.15,.12,.10],np.float32),col)
g=np.stack([.2+.5*(np.sin(pz*5)+1)/2,.45+.3*(py-1.4),.55+.3*np.cos(pz*3)],-1).astype(np.float32)
col=np.where(inner[...,None],np.clip(g,0,1),col)
# baseboards
bb=(wallx|wallz)&(py<.12)
col=np.where(bb[...,None],np.array([.97,.97,.95],np.float32),col)
# ambient occlusion near edges
dxe=np.minimum(RX-np.abs(px),RZ-np.abs(pz)); dye=np.minimum(py,RY-py)
ao=np.clip(.72+.28*np.minimum(np.minimum(dxe,dye)/.7,1),0,1)
ao=np.where(floor|ceil,np.clip(.7+.3*np.minimum(dxe/.8,1),0,1),ao)
col=col*np.where(emit,1,ao)[...,None]
best=t.copy()
def box(x0,x1,y0,y1,z0,z1,base,top=None,name=''):
    global col,best
    lo=np.array([x0,y0,z0],np.float32)-cam; hi=np.array([x1,y1,z1],np.float32)-cam
    d=[dx,dy,dz]; tn=-np.inf*np.ones_like(t); tf=np.inf*np.ones_like(t); face=np.zeros(t.shape,np.int8)
    for a in range(3):
        da=np.where(np.abs(d[a])<eps,eps,d[a])
        t1=lo[a]/da; t2=hi[a]/da
        n=np.minimum(t1,t2); f=np.maximum(t1,t2)
        upd=n>tn; face=np.where(upd,a,face); tn=np.maximum(tn,n); tf=np.minimum(tf,f)
    hit=(tn<tf)&(tn>0)&(tn<best)
    hx=cam[0]+dx*tn; hy=cam[1]+dy*tn; hz=cam[2]+dz*tn
    c=np.ones((H,W,3),np.float32)*np.array(base,np.float32)
    if top is not None:
        topm=(face==1)&(hy>=y1-1e-3)
        c=np.where(topm[...,None],np.array(top,np.float32),c)
    shade=np.where(face==1,1.0,np.where(face==0,.78,.88))[...,None]
    c=c*shade*(0.9+.1*np.sin((hx+hz)*30))[...,None]
    col=np.where(hit[...,None],c,col); best=np.where(hit,tn,best)
# furniture
box(-2.95,-1.95,0,.45,-1.35,1.35,[.33,.40,.50],[.38,.46,.58])       # sofa seat
box(-2.95,-2.55,.45,1.0,-1.35,1.35,[.30,.37,.47])                   # sofa back
box(-2.95,-1.95,.45,.7,-1.35,-1.05,[.30,.37,.47]); box(-2.95,-1.95,.45,.7,1.05,1.35,[.30,.37,.47])
box(-1.35,-.45,.0,.42,-.55,.55,[.36,.24,.14],[.45,.31,.18])         # coffee table
box(-1.05,-.75,.42,.50,-.15,.15,[.95,.95,.92])                      # vase / book
box(2.55,3.2,0,.55,-1.2,1.2,[.28,.20,.14],[.34,.25,.17])            # tv console
box(3.12,3.18,.85,1.65,-.85,.85,[.05,.05,.07])                      # tv
box(-.9,-.4,0,.45,1.9,2.4,[.18,.30,.20])                            # plant pot area
box(-.8,-.5,.45,1.2,2.0,2.3,[.25,.5,.28],[.3,.6,.32])              # plant
box(1.0,1.9,0,.45,-2.4,-1.6,[.55,.40,.30],[.62,.46,.34])            # armchair
# light falloff
fall=1/(1+.025*best**2); col=col*(0.85+.15*fall)[...,None]
img=np.clip(col,0,1)**(1/1.05)
Image.fromarray((img*255).astype(np.uint8)).save('public/assets/sample-room-360.jpg',quality=88,optimize=True)
