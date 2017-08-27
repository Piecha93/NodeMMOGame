


import * as SAT from 'sat';



let w: number = 32;
let h: number = 32;
let body: SAT.Polygon = new SAT.Polygon(new SAT.Vector(0,0), [
    new SAT.Vector(-w, -h), new SAT.Vector(w, -h),
    new SAT.Vector(w, h), new SAT.Vector(-w, h)
]);


console.log(body.angle);