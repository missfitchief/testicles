from pathlib import Path
import cv2,numpy as np

def protect_character(im,out,frame,reference=None):
    if frame is None or not 660<=frame<=706:return out
    if reference is not None:
        small=cv2.resize(im,(640,360));back=cv2.resize(reference,(640,360))
        mask=np.uint8(np.max(cv2.absdiff(small,back),axis=2)>16)*255
        mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
        contours,_=cv2.findContours(mask,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        filled=np.zeros_like(mask)
        cv2.drawContours(filled,[c for c in contours if cv2.contourArea(c)>12],-1,255,-1)
        filled=cv2.dilate(filled,np.ones((5,5),np.uint8))
        mask=cv2.GaussianBlur(cv2.resize(filled,(im.shape[1],im.shape[0])),(0,0),3).astype(np.float32)[:,:,None]/255
        return np.round(out*(1-mask)+im*mask).astype(np.uint8)
    keys=np.array([[660,900,1200,1020,1000],[666,960,1120,1080,810],[672,1050,780,1220,470],[678,1115,575,1360,230],[684,1200,350,1500,80],[690,1320,200,1620,15],[696,1420,155,1760,100],[706,1570,170,1900,100]],np.float32)
    coords=[int(np.interp(frame,keys[:,0],keys[:,i])) for i in range(1,5)]
    tail=tuple(coords[:2]);head=tuple(coords[2:]);mask=np.zeros(im.shape[:2],np.uint8)
    cv2.line(mask,tail,head,255,180);cv2.circle(mask,tail,95,255,-1);cv2.circle(mask,head,112,255,-1)
    mask=cv2.GaussianBlur(cv2.dilate(mask,np.ones((9,9),np.uint8)),(0,0),3).astype(np.float32)[:,:,None]/255
    return np.round(out*(1-mask)+im*mask).astype(np.uint8)

def repair(im,cx,half=175,parameters=None,strength=1,frame=None,texture=None):
    h,w=im.shape[:2];x0=max(0,int(cx-half));x1=min(w-1,int(cx+half))
    # Rebuild the broken dune using its intact cross-sections on both sides.
    light=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).astype(np.float32)
    light=cv2.GaussianBlur(light,(0,0),4)
    ridge=lambda x: float(220+np.argmax(light[220:640,int(x)]))
    if parameters is None:
        yl,yr=ridge(x0),ridge(x1)
        ml=np.clip((ridge(x0)-ridge(max(0,x0-50)))/50,-.7,.7)
        mr=np.clip((ridge(min(w-1,x1+50))-ridge(x1))/50,-.7,.7)
    else:yl,yr,ml,mr=parameters
    xs=np.arange(x0,x1+1,dtype=np.float32);t=(xs-x0)/(x1-x0);length=x1-x0
    curve=(2*t**3-3*t**2+1)*yl+(t**3-2*t**2+t)*length*ml+(-2*t**3+3*t**2)*yr+(t**3-t**2)*length*mr
    sy=np.arange(h,dtype=np.float32)[:,None]
    xl=x0+t*40;xr=x1-(1-t)*40
    rl=yl+ml*(xl-x0);rr=yr+mr*(xr-x1)
    source=im if texture is None else texture
    left=cv2.remap(source,np.tile(xl,(h,1)),(sy+rl-curve).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
    right=cv2.remap(source,np.tile(xr,(h,1)),(sy+rr-curve).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
    blend=(t*t*(3-2*t))[None,:,None]
    patch=left*(1-blend)+right*blend
    dy=sy-curve
    fade=(np.minimum(np.clip((360-dy)/180,0,1),np.clip((660-sy)/100,0,1))*strength)[:,:,None]
    out=im.copy();out[:,x0:x1+1]=np.clip(im[:,x0:x1+1]*(1-fade)+patch*fade,0,255).astype(np.uint8)
    return protect_character(im,out,frame,texture),{'left':yl,'right':yr,'slopeLeft':float(ml),'slopeRight':float(mr)}

if __name__=='__main__':
    import argparse,hashlib,json,subprocess
    parser=argparse.ArgumentParser(description='Repair the tracked dune seam without changing character action or frame timing.')
    parser.add_argument('--source',type=Path,default=Path('public/assets/story-desktop-seek-60-2k.mp4'))
    parser.add_argument('--tracking',type=Path,default=Path('source-assets/seam-repair-tracking.json'))
    parser.add_argument('--output',type=Path,default=Path('.project-state/seam-repair/repaired-segment-tagged.mp4'))
    args=parser.parse_args();data=json.loads(args.tracking.read_text())
    assert hashlib.sha256(args.source.read_bytes()).hexdigest()==data['sourceSha256'],'Unexpected source; do not apply old tracking to a different film.'
    assert args.source.resolve()!=args.output.resolve(),'Preserve the source.'
    args.output.parent.mkdir(parents=True,exist_ok=True);cv2.setNumThreads(2)
    cap=cv2.VideoCapture(str(args.source));assert cap.get(cv2.CAP_PROP_FRAME_WIDTH)==2560 and cap.get(cv2.CAP_PROP_FRAME_HEIGHT)==1440
    assert abs(cap.get(cv2.CAP_PROP_FPS)-60)<.001
    cap.set(cv2.CAP_PROP_POS_FRAMES,data['referenceFrame']);ok,reference=cap.read();assert ok
    cap.set(cv2.CAP_PROP_POS_FRAMES,data['start'])
    command=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','2560x1440','-r','60','-i','-','-an','-c:v','libx264','-threads','4','-preset','fast','-crf','16','-g','1','-keyint_min','1','-sc_threshold','0','-bf','0','-refs','1','-pix_fmt','yuv420p','-colorspace','bt470bg','-color_range','tv','-movflags','+faststart',str(args.output)]
    encoder=subprocess.Popen(command,stdin=subprocess.PIPE)
    try:
        for frame in range(data['start'],data['end']+1):
            ok,im=cap.read();assert ok
            i=frame-data['start'];t=frame/60
            p=min(1,max(0,(t-9.75)/.2),max(0,(17.5-t)/.15));strength=p*p*(3-2*p)
            out,_=repair(im,data['cx'][i],parameters=data['params'][i],strength=strength,frame=frame,texture=reference if 660<=frame<=720 else None)
            encoder.stdin.write(out.tobytes())
    finally:
        cap.release();encoder.stdin.close()
    assert encoder.wait()==0
