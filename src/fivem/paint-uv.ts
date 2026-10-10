/** Coordinate helpers for writing decals to a real GTA YTD texture via YFT mesh UVs. */
export function uvToPixel(u:number,v:number,width:number,height:number){
 if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1)
   throw new Error('Kliknięty mesh ma UV poza zakresem 0–1. Wybierz inną część lub teksturę.');
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>8192||height>8192)
   throw new Error('Niepoprawne wymiary tekstury GTA.');
 return {x:Math.min(width-1,u*width),y:Math.min(height-1,(1-v)*height)};
}
export function stampDimensions(requestedWidth:number,imgWidth:number,imgHeight:number){
 if(!Number.isFinite(requestedWidth)||requestedWidth<8||requestedWidth>2048)
   throw new Error('Szerokość logo musi wynosić 8–2048 px.');
 if(!Number.isFinite(imgWidth)||!Number.isFinite(imgHeight)||imgWidth<=0||imgHeight<=0)
   throw new Error('Niepoprawne wymiary logo.');
 return {width:requestedWidth,height:requestedWidth*imgHeight/imgWidth};
}
