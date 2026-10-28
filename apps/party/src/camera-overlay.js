// object-fit:contain centers the mirrored camera inside its CSS box.
// screenPoint flips x once; the fitted rectangle is symmetrical under flip.
export function containedVideoRect(width,height,videoWidth,videoHeight){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
  return {left:0,top:0,width:0,height:0};
 const ratio=Number.isFinite(videoWidth)&&Number.isFinite(videoHeight)&&
  videoWidth>0&&videoHeight>0?videoWidth/videoHeight:16/9;
 const w=Math.min(width,height*ratio),h=w/ratio;
 return {left:(width-w)/2,top:(height-h)/2,width:w,height:h};
}
export function videoRectStyle(r){
 return "left:"+r.left+"px;top:"+r.top+"px;width:"+r.width+"px;height:"+r.height+"px";
}
