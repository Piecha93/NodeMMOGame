

import {Bodies, Composites, Engine, IRunnerOptions, Runner, World, Body} from "matter-js";

let runnerOptions: IRunnerOptions;
let engine: Engine = Engine.create();
let world: World =  engine.world;


World.add(world, [
    // walls
    Bodies.rectangle(400, 0, 800, 50, { isStatic: true }),
    Bodies.rectangle(400, 600, 800, 50, { isStatic: true }),
    Bodies.rectangle(800, 300, 50, 600, { isStatic: true }),
    Bodies.rectangle(0, 300, 50, 600, { isStatic: true })
]);

world.gravity.scale = 0;

let rect: Body = Bodies.rectangle(300, 300, 32, 32);
let circle: Body = Bodies.circle(400, 0, 99);

World.add(world, rect);
World.add(world, circle);


setInterval(() => {
    Engine.update(engine, 1000 / 60);

    console.log("R: " + rect.position.y + " C: " + circle.position.y);
}, 50);
