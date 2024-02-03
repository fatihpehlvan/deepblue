import * as BABYLON from '@babylonjs/core'
import "@babylonjs/loaders/glTF";
import  Recast from "recast-detour";
import {GUI} from 'dat.gui';

let canvas;
let engine;
let scene;
//var navigation = new Navigation();
var materailList = []


let navmesh;
let agents = [];
let crowd;
let recastPlugin;
let pathLine;
let canvasCenterX;
let canvasCenterY;
let trashesOnSurface = []
let currentHoveredMesh = null;

let particleAnimation = false;
let startTime = null;
let moved = false;
let divFps = document.getElementById("fps");

let robotMoveAnimation = false;
let robotAnimationGroup;

let gizmoManager;
let gizmosActive = false;
let trashToRemove;
var shaderMaterial;
let glowLayer;

// trash count
let count = 0;
let planeWaveMaterial;
let planeOscillationMaterial;

let planeTexture;

let timelabel = document.getElementById("time");
let timebar = document.getElementById("time-bar");
let time = 90;
let soundsReady = 0;
let isSpotlight = true;
let spotlight = 1.0;
let score = 0;
let volume = 0.1;
let pointSound;
let backgroundSound;
let backgroundMusic;
let distance;

class Fish {

    constructor(mesh, start, end, position) {
        this.mesh = mesh;
        this.start = start;
        this.end = end;
        this.position = position;

    }


}

let mesh;
document.addEventListener("DOMContentLoaded", startGame);

async function startGame() {
    canvas = document.getElementById('renderCanvas');
    engine = new BABYLON.Engine(canvas, true);
    canvasCenterY = canvas.height / 2;
    canvasCenterX = canvas.width / 2;
    scene = await createScene();
    modifySettings();
    function toRender() {

        divFps.innerHTML = engine.getFps().toFixed() + " fps";
        updateTimebar();
        scene.render();
    }

    engine.runRenderLoop(toRender);
}


function createSkybox(scene) {
    const root = "..\\asset\\underwater\\";
    const skyboxUrls = [
        root + "uw_ft.jpg",
        root + "uw_up.jpg", //
        root + "uw_rt.jpg", //
        root + "uw_bk.jpg",
        root + "uw_dn.jpg", //
        root + "uw_lf.jpg"
    ];

    const skyboxTexture = BABYLON.CubeTexture.CreateFromImages(skyboxUrls, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = skyboxTexture;
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 300.0 }, scene);
    skybox.material = skyboxMaterial;

    return skybox
}
async function loadEnvironment(scene, light, camera) {
    return new Promise((resolve, reject) => {
        const meshes = [];
        let alb
        BABYLON.SceneLoader.ImportMesh("", "../asset/", "game.glb", scene, (loadedMeshes) => {

            loadedMeshes.forEach((m) => {

                var material = new BABYLON.ShaderMaterial("shader", scene, {
                    vertex: document.getElementById('vertex-shader-3d'),
                    fragment: document.getElementById('fragment-shader-3d'),
                }, {
                    attributes: ["position", "normal", "uv"],
                    uniforms: ["world", "worldViewProjection", "worldInverseTranspose", "lightWorldPosition", "viewWorldPosition", "color", "shininess", "lightDirection", "limit"],
                });

                //     // Set shader parameters
                material.setMatrix("world", m.getWorldMatrix());
                material.setMatrix("worldInverseTranspose", BABYLON.Matrix.Transpose(m.getWorldMatrix().clone().invertToRef(BABYLON.Matrix.Identity())));
                material.setVector3("lightWorldPosition", light.position);
                material.setVector3("viewWorldPosition", camera.position);
                material.setFloat("shininess", 32.0);
                material.setVector3("lightDirection", light.direction);
                material.setFloat("limit", Math.cos(BABYLON.Tools.ToRadians(120 ))); // 30 degrees limit



                if (m.material && m.material instanceof BABYLON.PBRMaterial) {
                    m.material.usePhysicalLightFalloff = false;
                }
                m.checkCollisions = true;
                if (m.id === "Navmesh") {
                    meshes.push(m);
                    m.position.y = -35.93;
                    m.isVisible = false;
                }
                else if (m.id === 'Sea_Plane') {
                    m.isVisible = false;
                } else if (m.id.startsWith('coral0')) {
                    m.isVisible = false;
                    m.isPickable = false;
                    m.checkCollisions = false;
                }


                //m.position.y = 5;
            });
            resolve(meshes); // Resolve the promise with the meshes array
        }, (prog) => {
            console.log(prog);
        }, (err) => {
            console.error(err);
            reject(err); // Reject the promise in case of an error
        });
    });
}
async function setupNavMesh(scene, meshes) {


    // var shaderMaterial = new BABYLON.ShaderMaterial("shader", scene, {
    //         vertex: document.getElementById("vertexShader"),
    //         fragment: document.getElementById('fragmentShader'),
    //     },
    //     {
    //         attributes: ["position"],
    //         uniforms: ["colors", "worldViewProjection"]
    //     });
    //
    //
    //
    //
    // shaderMaterial.setColor3("colors", new BABYLON.Color3(0.0, 0, 0))

    return new Promise(async (resolve, reject) => {

        try {


            const parameters = {
                cs: 1,
                ch: 1,
                walkableSlopeAngle: 35,
                walkableHeight: 1,
                walkableClimb: 1,
                walkableRadius: 1,
                maxEdgeLen: 12,
                maxSimplificationError: 1.3,
                minRegionArea: 8,
                mergeRegionArea: 20,
                maxVertsPerPoly: 6,
                detailSampleDist: 6,
                detailSampleMaxError: 1,
            };

            const recastPlugin = await new BABYLON.RecastJSPlugin(await Recast());

            await recastPlugin.createNavMesh(meshes, parameters);

            const navmeshdebug = await recastPlugin.createDebugNavMesh(scene);
            navmeshdebug.position.y -= 1;
            const matdebug = new BABYLON.StandardMaterial("matdebug", scene);
            matdebug.diffuseColor = new BABYLON.Color3(0.1, 0.2, 1);
            matdebug.alpha = 0.0;
            navmeshdebug.material = matdebug;
            navmeshdebug.isPickable = true;
            resolve({ navmesh: navmeshdebug, recastPlugin });
        } catch (error) {
            reject(error);
        }
    });

}
function createAgent(recastPlugin, scene, agents, robot) {
    var crowd = recastPlugin.createCrowd(10, 0.1, scene);

    var i;
    var agentParams = {
        radius: 0.1,
        height: 0.2,
        maxAcceleration: 100.0,
        maxSpeed: 5.0,
        collisionQueryRange: 0.5,
        pathOptimizationRange: 0.0,
        separationWeight: 1.0};

    for (i = 0; i <1; i++) {
        var width = 1;

        var targetCube = BABYLON.MeshBuilder.CreateBox("cube", { size: 0.1, height: 0.1 }, scene);
        targetCube.isVisible = false;

        var randomPos = recastPlugin.getRandomPointAround(robot.position, 0.5);
        randomPos.x = robot.position.x;
        randomPos.z = robot.position.x;


        var transform = new BABYLON.TransformNode();

        var agentIndex = crowd.addAgent(randomPos, agentParams, transform);
        agents.push({idx:agentIndex, trf:transform, mesh:robot, target:targetCube});
    }
    return {agents, crowd};
}
function getGroundPosition() {

    var pickinfo = scene.pick(event.clientX, event.clientY);
    if (pickinfo.hit) {
        return pickinfo.pickedPoint;
    }

    return null;
}
function pointerDown(mesh) {
    var startingPoint;
    var currentMesh;
    var pathLineVar;

    currentMesh = mesh;
    startingPoint = getGroundPosition();
    if (startingPoint) {
        var agents = crowd.getAgents();
        var i;
        for (i=0;i<agents.length;i++) {
            let ag = agents[i];
            let vel = crowd.getAgentVelocity(ag.idx);
            if (vel.length() > 0.2 || particleAnimation) return;
            //var randomPos = recastPlugin.getRandomPointAround(startingPoint, 1.0);
            const closestPoint = recastPlugin.getClosestPoint(startingPoint);
            if (
                closestPoint._x === 0.0 &&
                closestPoint._y === 0.0 &&
                closestPoint._z === 0.0
            )  return;

            crowd.agentGoto(ag, recastPlugin.getClosestPoint(startingPoint));

        }
        var pathPoints = recastPlugin.computePath(crowd.getAgentPosition(agents[0]), recastPlugin.getClosestPoint(startingPoint));
        pathLineVar = BABYLON.MeshBuilder.CreateDashedLines("ribbon", {points: pathPoints, updatable: true, instance: pathLine}, scene);
        const pathLineVarMaterial = new BABYLON.StandardMaterial('ribbon metarial', scene);
        pathLineVarMaterial.emissiveColor = new BABYLON.Color3(1.0, 1.0, 1.0);
        pathLineVar.material = pathLineVarMaterial;
        document.getElementById('path').addEventListener('change', (event) => {
            pathLineVar.isVisible = event.currentTarget.checked;
        })
    }
    pathLine = pathLineVar;
    return {startingPoint, currentMesh};
}


let animationTimeout;
function sceneOnPointObservable(scene) {

    function animateMaterialColorChange(mesh, targetColor) {
        // this function animate the trash objects if mouse on it
        const material = mesh.material;
        material.emissiveColor = new BABYLON.Color3((78+42)/255, 30/255, 30/255);
        material.visibility = 0.7
        if (material) {
            glowLayer.addIncludedOnlyMesh(mesh);
            glowLayer.intensity = 0.0; // Initial intensity set to 0

            const colorAnimation = new BABYLON.Animation(
                "colorAnimation",
                "albedoColor",
                180,
                BABYLON.Animation.ANIMATIONTYPE_COLOR3,
                BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
            );

            const keys = [];
            // first 60 seconds make redish
            // second 60 second make original color
            keys.push({ frame: 0, value: material.albedoColor.clone() });
            keys.push({ frame: 60, value: targetColor });
            keys.push({ frame: 120, value: material.albedoColor.clone() });
            colorAnimation.setKeys(keys);

            material.animations.push(colorAnimation);
            scene.beginAnimation(material, 0, 120, true);

            let frameCount = 0;
            const maxFrameCount = 120; // Total animation frames

            const animateGlowIntensity = () => {
                // added glow effect on the trashes
                glowLayer.intensity = Math.sin((frameCount / maxFrameCount) * Math.PI) / 2;
                frameCount++;
                animationTimeout = setTimeout(animateGlowIntensity, 1); // Adjust the delay for smoother animation
            };

            animateGlowIntensity();
        }
    }


    // this function handles mouse move
    scene.onPointerMove = (event, pickResult) => {
        const pickedMesh = scene.pick(event.clientX, event.clientY);
        if (pickedMesh) console.log(pickedMesh.pickedMesh.id)
        if (currentHoveredMesh && currentHoveredMesh.id !== pickedMesh.pickedMesh.id) {
            // this if block handles if two trashes is next to each other according to 2d scene
            // stop the first trash animation and rollback other properties
            scene.stopAnimation(currentHoveredMesh.material, 'colorAnimation');
            currentHoveredMesh.material.albedoColor = new BABYLON.Color3(1.0, 1.0, 1.0);
            currentHoveredMesh.material.emissiveColor = new BABYLON.Color3(0.0, 0, 0);
            glowLayer.removeIncludedOnlyMesh(currentHoveredMesh);
            clearTimeout(animationTimeout)
        }
        if (currentHoveredMesh && currentHoveredMesh === pickedMesh.pickedMesh) {
            // this if block ensures that if mouse move on the same trash it makes nothing.
            // So animation plays

        }else if (currentHoveredMesh) {
            // Stop the animation if mouse moves except another trash
            // rollback initial properties
            scene.stopAnimation(currentHoveredMesh, 'colorAnimation');
            currentHoveredMesh.material.albedoColor = new BABYLON.Color3(1.0, 1.0, 1.0);
            currentHoveredMesh.material.emissiveColor = new BABYLON.Color3(0.0, 0, 0);
            currentHoveredMesh.material.animations.length = 0;
            glowLayer.removeIncludedOnlyMesh(currentHoveredMesh);
            clearTimeout(animationTimeout)
            currentHoveredMesh = null;
        }
        else if (pickedMesh.hit && pickedMesh.pickedMesh.name.startsWith("Trash")) {
            // start the animation if the pointer on the trash
            currentHoveredMesh = pickedMesh.pickedMesh;
            animateMaterialColorChange(currentHoveredMesh, new BABYLON.Color3(1.0, 0.0, 0.0)); // Reddish color
        }

    };


    scene.onPointerObservable.add((pointerInfo) => {

        switch (pointerInfo.type) {
            case BABYLON.PointerEventTypes.POINTERDOWN:
                if(pointerInfo.event.button === 1 && pointerInfo.pickInfo.hit) {
                    if (pointerInfo.pickInfo.pickedMesh.name.startsWith('Trash') && !robotMoveAnimation && !moved) {
                        trashToRemove = pointerInfo.pickInfo.pickedMesh;
                    } else if (pointerInfo.pickInfo.pickedMesh.name.startsWith('Trash')){

                    } else {
                        trashToRemove = null;

                    }
                    pointerDown(pointerInfo.pickInfo.pickedMesh);
                }
                break;
        }
    });
}

function sceneOnBeforeRender(scene, particleSystem, camera, light){
    scene.onBeforeRenderObservable.add(()=> {
        camera.position.x = clamp(camera.position.x, -148, 148);
        camera.position.y = clamp(camera.position.y, -148, 148);
        camera.position.z = clamp(camera.position.z, -148, 148);

        const material = mesh.material;
        material.setVector3("lightDirection", light.direction);
        material.setFloat("limit", Math.cos((light.angle/2)));
        material.setFloat("intensity", light.intensity);
        material.setFloat('time', performance.now())

        material.setTexture('texturePlane', planeTexture)


        materialWave.setFloat("time", performance.now());

        seashell.material.setTexture("seashellTextureSampler", seashellTexture);



        var agentCount = agents.length;
        for (let i = 0; i < agentCount; i++) {
            var ag = agents[i];
            ag.mesh.position = crowd.getAgentPosition(ag.idx);

            let vel = crowd.getAgentVelocity(ag.idx);
            crowd.getAgentNextTargetPathToRef(ag.idx, ag.target.position);
            if (vel.length() > 0.2) {

                if (!robotMoveAnimation) {
                    stopRobotAnimations();
                    walkingAnimation();

                }
                robotMoveAnimation = true;
                moved = true;
                const oscillationFactor = 0.01; // Adjust as needed

                vel.normalize();
                var desiredRotation = Math.atan2(vel.x, vel.z);
                ag.mesh.rotation.y = ag.mesh.rotation.y + (desiredRotation - ag.mesh.rotation.y) * 0.05;
                ag.mesh.rotation.z = Math.cos(performance.now() * oscillationFactor) * Math.PI / 16;
            } else {

                if (robotMoveAnimation) {
                    stopRobotAnimations();
                    idleAnimation();
                }
                robotMoveAnimation = false;
                // these block responsible for agent stopping. starts agent particle animation and waits 10 seconds for next move
                if (moved) {


                    if (startTime === null) {
                        startTime = performance.now()
                    }
                    if (performance.now() - startTime > 1000) {
                        particleAnimation = false;
                        startTime = null;
                        moved = false;
                        if (trashToRemove) {
                            score = parseInt(localStorage.getItem('Score'));
                            score += 20;
                            localStorage.setItem('Score', score.toString());
                            document.getElementById('score').innerHTML = localStorage.getItem('Score');
                            pointSound.play();

                            const idx = trashesOnSurface.indexOf(trashToRemove);
                            trashesOnSurface.splice(idx, 1);
                            trashToRemove.dispose();
                            count--;
                        }
                        particleSystem.stop();
                    } else {

                        particleSystem.emitter = ag.mesh.position;

                        particleSystem.start();
                        particleAnimation = true;

                    }
                }

                ag.mesh.rotation.z = 0;
            }
        }

    });
}

function createTrashes(scene) {
    return new Promise((resolve, reject) => {
        let meshes = [];
        BABYLON.SceneLoader.ImportMesh("", "..\\asset\\", "trashes.glb", scene, function (loadedMeshes) {
            loadedMeshes.forEach((m) => {
                if (m.material instanceof BABYLON.PBRMaterial) {
                    m.material.usePhysicalLightFalloff = false;
                }
                if (m.id !== "__root__")
                    meshes.push(m);
                m.scaling = new BABYLON.Vector3(2, 2, 2);
                m.isVisible = false;
            });

            // Resolve the promise with the loaded meshes
            resolve(meshes);
        }, null, function (scene, e) {
            console.error("Error loading meshes:", e);
            reject(e);
        });
    });
}

function generateRandomPointOnSurface(navmesh) {
    let point;
    let hit = false;
    const direction =  new BABYLON.Vector3(0, 1, 0);
    const minBounds = new BABYLON.Vector3(-70, 0, -70); // Define your minimum bounds
    const maxBounds = new BABYLON.Vector3(70, 0, 70); // Define your maximum bounds
    while (!hit) {
        point = new BABYLON.Vector3(
            BABYLON.Scalar.RandomRange(minBounds.x, maxBounds.x),
            -35.93,
            BABYLON.Scalar.RandomRange(minBounds.z, maxBounds.z)
        );
        var ray = new BABYLON.Ray(point, direction);

        var pickInfo = ray.intersectsMesh(navmesh);
        hit = pickInfo.hit;
    }
    point.y = -17.8;
    return point;
}
function randomTrash(trashes) {
    const randomIndex = Math.floor(Math.random() * trashes.length);
    return trashes[randomIndex].clone();
}

function randomInt(list) {
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
}

function generateRandomTrashesOnSurface(navmesh, trashes, scene) {
    if (count <= 10) {
        const point = generateRandomPointOnSurface(navmesh);
        const trash = randomTrash(trashes);
        if (trash) {
            trash.position.copyFrom(point); // Set the position of the trash
            trash.isVisible = true; // Make the trash visible
            trash.scaling = new BABYLON.Vector3(10, 10, 10);
            trash.showBoundingBox = true;

            trash.name = `Trash_${count}`;
            trash.id = `Trash_${count}`;
            trash.checkCollisions = true;
            trashesOnSurface.push(trash);


            let newMaterial = trash.material.clone();
            newMaterial.animations = []
            trash.material = newMaterial;
            scene.addMesh(trash);

        }
        console.log('trahs count', count)
        count++;
    }

}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}


function createFreeCamera(scene) {
    let camera = new BABYLON.FreeCamera('myCamera', new BABYLON.Vector3(0, 10, 0), scene);
    camera.speed = 0.7;
    camera.minZ = .1;

    camera.attachControl(canvas);
    const x = 4
    camera.ellipsoid = new BABYLON.Vector3(x, x, x);


    camera.checkCollisions = true;

    camera.keysUp.push('w'.charCodeAt(0));
    camera.keysUp.push('W'.charCodeAt(0));
    camera.keysDown.push('s'.charCodeAt(0));
    camera.keysDown.push('S'.charCodeAt(0));
    camera.keysRight.push('d'.charCodeAt(0));
    camera.keysRight.push('D'.charCodeAt(0));
    camera.keysLeft.push('a'.charCodeAt(0));
    camera.keysLeft.push('A'.charCodeAt(0));
    document.addEventListener('keydown', (evt)=> {
        switch (evt.key){
            case 'e' || 'E':
                camera.rotation.z += BABYLON.Tools.ToRadians(-1);
                break;
            case 'q' || 'Q':
                camera.rotation.z += BABYLON.Tools.ToRadians(1);
                break;
            case 'o' || 'O':
                camera.upVector = new BABYLON.Vector3(0, 1, 0);
                camera.rotation.z = 0;

                camera.rotation.z = 0;
                camera.upVector = new BABYLON.Vector3(0, 1, 0);
                break;
        }

    })

    return camera;
}

function createCrosshair(scene, camera) {
    let crosshair = new BABYLON.MeshBuilder.CreateBox('crosshair', {
        width: .01,
        height: .01,
    }, scene);

    crosshair.parent = camera;
    crosshair.position.z += 1;

    const crosshairMaterial = new BABYLON.StandardMaterial('crosshair', scene);
    crosshairMaterial.diffuseTexture = new BABYLON.Texture('../asset/gunaims.png', scene)
    crosshairMaterial.diffuseTexture.hasAlpha = true;
    crosshairMaterial.disableLighting = true;
    crosshair.material = crosshairMaterial;
    crosshair.isPickable = false;

}

function createParticleSystem(scene) {
    const particleSystem = new BABYLON.ParticleSystem("particles", 10000, scene);
    particleSystem.particleTexture = new BABYLON.Texture("../asset/particle3.png");
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 1.0;

    const radius = 3;
    particleSystem.minEmitBox = new BABYLON.Vector3(-radius / 2, 0, -radius / 2);
    particleSystem.maxEmitBox = new BABYLON.Vector3(radius / 2, 0, radius / 2);
    particleSystem.color1 = new BABYLON.Color4(64/255, 47/255, 7/255, 1.0);
    particleSystem.color2 = new BABYLON.Color4(33/255, 23/255, 1/255, 1.0);
    particleSystem.emitRate = 75;
    return particleSystem;
}

function printAllMeshNames(scene) {
    scene.meshes.forEach((mesh) => {
        console.log(mesh.name);
    });
}

function createRobot(scene) {
    return new Promise((resolve, reject) => {
        let par = new BABYLON.Mesh('robot', scene);
        let initialRobotPosition = new BABYLON.Vector3(0, 0, 0);
        let initialParPosition = new BABYLON.Vector3(10, -10, 0);

        BABYLON.SceneLoader.ImportMesh("", "../asset/", "robot.glb", scene, function (loadedMeshes, particleSystems, skeletons, animationGroups) {
            let robot = loadedMeshes[0];
            loadedMeshes.forEach(mesh => {
                if (mesh.material instanceof BABYLON.PBRMaterial) {
                    mesh.material.usePhysicalLightFalloff = false;
                }
                mesh.checkCollisions = false;
            });

            robot.position.copyFrom(initialRobotPosition);
            par.position.copyFrom(initialParPosition);

            par.checkCollisions = true;
            robotAnimationGroup = animationGroups;
            robot.parent = par;
            robot = par;


            resolve(robot);
        }, null, function (scene, e) {
            console.error("Error loading meshes:", e);
            reject(e);
        });
    });
}


function walkingAnimation() {
    for (let i = 0; i < robotAnimationGroup.length; i++) {
        robotAnimationGroup[i].start(true, 2, 250, 298);
    }
}
function idleAnimation() {
    for (let i = 0; i < robotAnimationGroup.length; i++) {
        robotAnimationGroup[i].start(true, 2, 0, 230);
    }
}

function stopRobotAnimations() {
    for (let i = 0; i < robotAnimationGroup.length; i++) {
        robotAnimationGroup[i].stop();
    }
}

function initializeGUI(light) {
    var gui = new GUI();
    gui.domElement.style.marginTop = "100px";
    gui.domElement.id = "datGUI";

    var options = {
        intensity: light.intensity,
        angle: light.angle,
        directionX: light.direction.x,
        directionY: light.direction.y,
        directionZ: light.direction.z,
        positionX: light.position.x,
        positionY: light.position.y,
        positionZ: light.position.z,
        enableSpotlight: isSpotlight
    };

    gui.add(options, "intensity", 0, 1).onChange(function(value) {
        spotlight =value;
        if(isSpotlight){
            light.intensity = value;
        }
    });

    gui.add(options, "angle", 0, Math.PI * 2).onChange(function(value) {
        light.angle = value;
    });

    gui.add(options, "directionX", -1, 1).onChange(function(value) {
        light.direction.x = value;

    });

    gui.add(options, "directionY",-1, 1).onChange(function(value) {
        light.direction.y = value;
    });

    gui.add(options, "directionZ", -1, 1).onChange(function(value) {
        light.direction.z = value;
    });

    gui.add(options, "positionX", -100, 100).onChange(function(value) {
        light.position.x = value;
    });

    gui.add(options, "positionY", -100, 100).onChange(function(value) {
        light.position.y = value;
    });

    gui.add(options, "positionZ", -100, 100).onChange(function(value) {
        light.position.z = value;
    });

    gui.add(options, 'enableSpotlight').name('Spotlight').onChange(function(value) {
        isSpotlight = value;
        if (!isSpotlight){
            light.intensity = 0;
        }
        else {
            light.intensity = spotlight;
        }
    });


    // choices
    // seashell.material = material;

}

let seashell;
async function createSeashell(path, scene,gizmoManager){
    const scaleFac = 7;
    return new Promise((resolve, reject) => {

        BABYLON.SceneLoader.ImportMesh("", "../asset/seashell/", path, scene, function (loadedMeshes) {
            let seashellMesh;
            loadedMeshes.forEach(mesh => {
                if (mesh.material instanceof BABYLON.PBRMaterial) {
                    mesh.material.usePhysicalLightFalloff = false;

                }

                if(mesh.id !== "__root__"){
                    seashellMesh = mesh;
                }
                mesh.checkCollisions = true;
                mesh.isVisible = true;
                mesh.scaling = new BABYLON.Vector3(scaleFac,scaleFac,scaleFac);

            });
            loadedMeshes[0].rotation = new BABYLON.Vector3(-1.4797854677613425,-2.782473439385022,2.7850895292067346);
            //loadedMeshes[0].position = new BABYLON.Vector3(107.7281494140625,-34.65361785888672,-70.14183807373047);
            loadedMeshes[0].position = new BABYLON.Vector3(16.23896026611328,-32.681114196777344,-70.18516540527344);

            gizmoManager.attachableMeshes.push(loadedMeshes[0]);
            resolve(seashellMesh);
        }, null, function (scene, e) {
            console.error("Error loading meshes:", e);
            reject(e);
        });
    });
}



const fishes = [];
function createFishes(path, scene) {
    return new Promise((resolve, reject) => {

        BABYLON.SceneLoader.ImportMesh("", "../asset/fish/", path, scene, function (loadedMeshes, particleSystems, skeletons, animationGroups) {

            loadedMeshes.forEach(mesh => {
                if (mesh.material instanceof BABYLON.PBRMaterial) {
                    mesh.material.usePhysicalLightFalloff = false;

                }
                if (mesh.id === "__root__") {
                    fishes.push(mesh);
                    //mesh.scaling = new BABYLON.Vector3(10, 10, 10);
                }

                mesh.checkCollisions = true;
                mesh.isVisible = false;

            });


            resolve(loadedMeshes[0]);
        }, null, function (scene, e) {
            console.error("Error loading meshes:", e);
            reject(e);
        });
    });
}
function getParent(mesh) {
    if (!mesh.parent) return mesh;
    return getParent(mesh.parent);
}
let fishesOnScene = [];
let lastFish;
let lastCurrentFrame;
let sameBefore = true;
let fishParent
let initialTrashPos;
let isDeleted = true;
let fishRotate;
function generateRandomFishesOnScene(fishes, scene, fishCount) {
    const minBounds = new BABYLON.Vector3(-120, 20, -120);
    const maxBounds = new BABYLON.Vector3(120, 100, 120);
    const randomIndex = randomInt([0, 1, 2, 3]);
    const point = new BABYLON.Vector3(
        BABYLON.Scalar.RandomRange(minBounds.x, maxBounds.x),
        BABYLON.Scalar.RandomRange(minBounds.y, maxBounds.y),
        BABYLON.Scalar.RandomRange(minBounds.z, maxBounds.z)
    );
    const offset = 160;

    let rotationCoefficient=0;

    switch (randomIndex) {
        case 0:
            point.x = -offset;
            rotationCoefficient=0.5;
            break;
        case 1:
            point.x = offset;
            rotationCoefficient= -0.5;
            break;
        case 2: //original rotation
            point.z = -offset;
            rotationCoefficient=0;
            break;
        case 3: // rotate 180 degrees
            point.z = offset;
            rotationCoefficient = 1;
            break;
    }

    const fish = randomTrash(fishes);
    fish.isVisible = true;
    fish.getChildMeshes().forEach(child => {
        child.isVisible = true;
    })
    if (fish) {

        fish.position.copyFrom(point);

        fish.id = `Fish_${fishCount}`;
        fish.name = `Fish_${fishCount}`;

        fish.rotate(BABYLON.Axis.Y, rotationCoefficient*Math.PI);

        // fish.getChildMeshes().forEach(f => {
        //     f.id = `Fish_${fishCount}`;
        //     f.name = `Fish_${fishCount}`;
        //
        // })

        // Movement animation
        const st = (fish.position.x === offset || fish.position.x === -offset) ? "position.x" : "position.z";
        const animation = new BABYLON.Animation(
            "fishMovement",
            st,
            60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        const pos = (fish.position.x === offset || fish.position.x === -offset) ? fish.position.x : fish.position.z;
        const keys = [];
        keys.push({
            frame: 0,
            value: pos,
        });
        keys.push({
            frame: 2000,
            value: pos === -offset ? offset : -offset,
        });

        animation.setKeys(keys);
        fish.animations = [animation];
        const parentMesh = fish.parent || fish;
        scene.beginAnimation(parentMesh, 0, 2000, false);


        // Remove fish when animation completes
        animation.onAnimationEnd = function () {
            const index = fishesOnScene.indexOf(fish);
            if (index !== -1) {
                fishesOnScene.splice(index, 1);
                fish.dispose();
            }
        };

        fish.isPickable = true;

        scene.onPointerDown = function (evt, pickResult) {

            if (isDeleted && pickResult.hit &&
                (pickResult.pickedMesh.id.startsWith('Fish') ||
                    pickResult.pickedMesh.id.startsWith('.Armature') ||
                    pickResult.pickedMesh.id.startsWith('.Sketch') ||
                    pickResult.pickedMesh.id.startsWith('.trash')))
            {
                isDeleted = false;
                const parent = getParent(pickResult.pickedMesh)
                let pickedFish;
                fishesOnScene.forEach(f => {
                    if(f.id === parent.id) {
                        pickedFish = f;
                        return;
                    }

                })
                let currentFrame;
                if (pickedFish){
                    fishRotate = pickedFish.rotation;

                    const playingAnimations = pickedFish.animations[0];

                    try {
                        sameBefore = false;
                        currentFrame = playingAnimations._runtimeAnimations[0].currentFrame;
                    }
                    catch (e) {
                        sameBefore = true;
                        currentFrame = lastCurrentFrame;

                    }


                    scene.stopAnimation(pickedFish);


                    let trashParent;
                    let trashes = [];
                    let fishArm;

                    pickedFish.getChildMeshes().forEach(f => {


                        if (f.id.includes("trash")) {
                            f.scaling = new BABYLON.Vector3(1,1,1);
                            trashes.push(f);

                        } else {
                            fishArm = f;
                        }

                    })
                    console.log(trashes)
                    trashParent = trashes[0];


                    if (trashParent && trashParent.parent) {
                        const localRotation = trashParent.rotation.clone();
                        initialTrashPos = trashParent.position;
                        fishParent = trashParent.parent;
                        //trashParent.position = trashParent.parent.getAbsolutePosition();

                        const scaleFactor = 1.3
                        const scale = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor)
                        if (trashParent.parent.scaling) {
                            trashParent.scaling = scale;
                        }
                        trashParent.rotation = trashParent.parent.rotation

                        var rotation = BABYLON.Quaternion.Identity()
                        var position = BABYLON.Vector3.Zero()

                        trashParent.getWorldMatrix().decompose(BABYLON.Vector3.Zero(), rotation, position)

                        if (trashParent.rotationQuaternion) {
                            trashParent.rotationQuaternion.copyFrom(rotation)
                        } else {

                            trashParent.rotation.y *=  Math.PI/180;
                            rotation.toEulerAnglesToRef(trashParent.rotation )
                        }
                        trashParent.position.x = position.x
                        trashParent.position.y = position.y
                        trashParent.position.z = position.z

                        trashParent.parent = null;
                        trashParent.rotate(BABYLON.Axis.Z, Math.PI)
                        //trashParent.rotation = localRotation
                    }
                    gizmoManager.attachableMeshes.push(trashParent)
                    gizmoManager.attachableMeshes.push(fishArm)


                    gizmoManager.gizmos.positionGizmo.onDragEndObservable.add(() => {
                        try {
                            console.log("Position Gizmo Drag End");
                            console.log('fish', fishArm.position);
                            console.log('trash', trashParent.position);
                            distance = BABYLON.Vector3.Distance(fishArm.getAbsolutePosition(), trashParent.position);
                            console.log('Distance between fish and trash:', distance);
                            if (distance > 3 && distance < 500) {
                                gizmoManager.attachToMesh(null);
                                //gizmoManager.attachableMeshes.remove(trashParent);
                                trashParent.position = new BABYLON.Vector3(2000, 2000, 2000);

                                score = parseInt(localStorage.getItem('Score'));
                                score += 20;
                                localStorage.setItem('Score', score.toString());
                                document.getElementById('score').innerHTML = localStorage.getItem('Score');
                                pointSound.play();
                                console.log("score from fish");

                                const animationRange = { from: lastCurrentFrame, to: 2000 };
                                scene.beginAnimation(lastFish, animationRange.from, animationRange.to, false);
                                fishArm.rotation = fishRotate;
                                isDeleted = true;

                            }
                            else if (distance >= 500) {
                                isDeleted = true;
                                const animationRange = { from: lastCurrentFrame, to: 2000 };
                                scene.beginAnimation(lastFish, animationRange.from, animationRange.to, false);
                            }
                            else {
                                scene.stopAnimation(lastFish);

                            }

                        }
                        catch (e){

                        }
                    });



                    lastCurrentFrame = currentFrame;
                    lastFish = pickedFish;


                }


            }
        };
        fishesOnScene.push(fish)

        scene.addMesh(fish);
    }
}


function gizmoListeners (gizmoManager) {
    gizmoManager.positionGizmoEnabled = true;
    document.addEventListener('keydown', (evt)=> {
        switch (evt.key){
            case '1':
                gizmoManager.positionGizmoEnabled = true;
                gizmoManager.rotationGizmoEnabled = false;
                break;
            case '2':
                gizmoManager.rotationGizmoEnabled = true;
                gizmoManager.positionGizmoEnabled = false;
                break;
            case '3':
                break;
        }

    })
}

function initializePlaneWaveMaterial(light, camera) {
    planeWaveMaterial = new BABYLON.ShaderMaterial("shader", scene, {
        vertexSource: document.getElementById('waveVertexShader').textContent,
        fragmentSource: document.getElementById('fragment-shader-3d').textContent,
    }, {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldViewProjection", "worldInverseTranspose", "lightWorldPosition", "viewWorldPosition", "color", "shininess", "lightDirection", "limit"],
        samplers: ["texturePlane"]
    });


    // Set shader parameters
    planeWaveMaterial.setMatrix("world", mesh.getWorldMatrix());
    planeWaveMaterial.setMatrix("worldInverseTranspose", BABYLON.Matrix.Transpose(mesh.getWorldMatrix().clone().invertToRef(BABYLON.Matrix.Identity())));
    planeWaveMaterial.setVector3("lightWorldPosition", light.position);
    planeWaveMaterial.setVector3("viewWorldPosition", camera.position);
    planeWaveMaterial.setFloat("intensity", light.intensity);
    planeWaveMaterial.setVector3("lightDirection", light.direction);
    planeWaveMaterial.setFloat("limit", Math.cos((light.angle/2)));
    planeWaveMaterial.setFloat('time', performance.now())

    var texture = new BABYLON.Texture("../asset/planeTexture.jpg", scene);
    planeWaveMaterial.setTexture('texturePlane', texture)

    mesh.material = planeWaveMaterial;


}

function initializePlaneOscillationMaterial(light, camera) {
    planeOscillationMaterial = new BABYLON.ShaderMaterial("shader", scene, {
        vertexSource: document.getElementById('oscillationVertexShader2').textContent,
        fragmentSource: document.getElementById('fragment-shader-3d').textContent,
    }, {
        attributes: ["position", "normal", "uv"],
        uniforms: ["world", "worldViewProjection", "worldInverseTranspose", "lightWorldPosition", "viewWorldPosition", "color", "shininess", "lightDirection", "limit"],
        samplers: ["texturePlane"]
    });


    // Set shader parameters
    planeOscillationMaterial.setMatrix("world", mesh.getWorldMatrix());
    planeOscillationMaterial.setMatrix("worldInverseTranspose", BABYLON.Matrix.Transpose(mesh.getWorldMatrix().clone().invertToRef(BABYLON.Matrix.Identity())));
    planeOscillationMaterial.setVector3("lightWorldPosition", light.position);
    planeOscillationMaterial.setVector3("viewWorldPosition", camera.position);
    planeOscillationMaterial.setFloat("intensity", light.intensity);
    planeOscillationMaterial.setVector3("lightDirection", light.direction);
    planeOscillationMaterial.setFloat("limit", Math.cos((light.angle/2)));
    planeOscillationMaterial.setFloat('time', performance.now())

    var texture = new BABYLON.Texture("../asset/planeTexture.jpg", scene);
    planeWaveMaterial.setTexture('texturePlane', texture)
}
let materialWave;
let materialFresnel;
let materialBlur;
var seashellTexture ;
async function createScene() {
    let scene = new BABYLON.Scene(engine);
    glowLayer = new BABYLON.GlowLayer("glow", scene)

    const skybox = createSkybox(scene);
    let camera = createFreeCamera(scene);
    const utilLayer = new BABYLON.UtilityLayerRenderer(scene);
    var light = new BABYLON.SpotLight("spotLight", new BABYLON.Vector3(0,150 , 0), new BABYLON.Vector3(0, -1, 0), Math.PI / 3, 10, scene);
    light.diffuse = new BABYLON.Color3(1, 1, 1);
    const lightGizmo = new BABYLON.LightGizmo(utilLayer)
    lightGizmo.light = light;
    console.log(light);
    initializeGUI(light);

    //console.log((await createRobot(scene)))


    gizmoManager = new BABYLON.GizmoManager(scene);
    gizmoManager.attachableMeshes = [];
    gizmoListeners(gizmoManager);

    seashellTexture = new BABYLON.Texture("..\\asset\\seashell\\seashellTexture.jpg", scene)
    seashell = await createSeashell("seashell.glb", scene, gizmoManager);

    materialFresnel = new BABYLON.ShaderMaterial("shader", scene, {
        vertexSource: document.getElementById('FresnelVertex').textContent,
        fragmentSource: document.getElementById('FresnelFragment').textContent,
    }, {
        attributes: ["position", "uv","normal"],
        uniforms: ["worldViewProjection", "world","cameraPosition","time"],
        samplers: ["seashellTextureSampler"]
    });
    materialFresnel.setTexture('seashellTextureSampler', seashellTexture);
    materialFresnel.setVector3("cameraPosition", camera.position);
    materialFresnel.setFloat("time", performance.now());



    materialWave = new BABYLON.ShaderMaterial("shader", scene, {
        vertexSource: document.getElementById('seashellWaveVertex').textContent,
        fragmentSource: document.getElementById('seashellWaveFragment').textContent,
    }, {
        attributes: ["position", "uv","normal"],
        uniforms: ["worldViewProjection", "world","cameraPosition","time"],
        samplers: ["seashellTextureSampler"]
    });
    materialWave.setTexture('seashellTextureSampler', seashellTexture);
    materialWave.setVector3("cameraPosition", camera.position);



    materialBlur = new BABYLON.ShaderMaterial("shader", scene, {
        vertexSource: document.getElementById('blurVertex').textContent,
        fragmentSource: document.getElementById('blurFragment').textContent,
    }, {
        attributes: ["position", "uv"],
        uniforms: ["worldViewProjection"],
        samplers: ["seashellTextureSampler"]
    });
    materialBlur.setTexture('seashellTextureSampler', seashellTexture);
    materialBlur.setVector3("cameraPosition", camera.position);

    seashell.material = materialFresnel;



    const meshes = await loadEnvironment(scene, light, camera);
    // // // console.log(meshes);
    ({navmesh, recastPlugin} = await setupNavMesh(scene, meshes));
    const robot = await createRobot(scene, recastPlugin, agents);
    // // //
    ({agents, crowd} = createAgent(recastPlugin, scene, agents, robot));
    // // // //
    const particleSystem = createParticleSystem(scene);
    // // // //
    planeTexture = new BABYLON.Texture("../asset/planeTexture.jpg", scene);
    sceneOnPointObservable(scene, camera);
    sceneOnBeforeRender(scene, particleSystem, camera, light);
    //

    await createFishes("dirtyKoiPlastic.glb", scene);

    let fishCount = 0;
    setInterval(() => {
        fishCount += 1;
        generateRandomFishesOnScene(fishes, scene, fishCount);
    }, 1000);

    const trashes = await createTrashes(scene);

    setInterval(() => {

        generateRandomTrashesOnSurface(navmesh, trashes, scene);
    }, 1000);
    var size = 300;


    mesh = BABYLON.MeshBuilder.CreatePlane("plane", {size:size}, scene);
    mesh.increaseVertices(100);
    mesh.position.y = -35.93;

    mesh.rotation.x = Math.PI/2;

    initializePlaneWaveMaterial(light, camera);
    initializePlaneOscillationMaterial(light, camera);




    //createCrosshair(scene, camera);

    //scene.environmentTexture = hdrTexture;

    // Disable the default audio unlock button
    BABYLON.Engine.audioEngine.useCustomUnlockedButton = true;
    // Unlock audio on first user interaction.
    window.addEventListener('click', () => {
        if(!BABYLON.Engine.audioEngine.unlocked){
            BABYLON.Engine.audioEngine.unlock();
        }
    }, { once: true });

    backgroundSound = new BABYLON.Sound("backgroundSound", "../asset/sounds/ScubaDivingSounds.mp3", scene, soundReady, { loop: true, volume: volume });
    backgroundMusic = new BABYLON.Sound("backgroundMusic", "../asset/sounds/UnderwaterBattleMusic.mp3", scene, soundReady, { loop: true, volume: volume });
    pointSound = new BABYLON.Sound("pointSound", "../asset/sounds/GetPointSoundEffect.mp3", scene, { volume: volume });
    //pointSound.play();

    function soundReady() {
        BABYLON.Engine.audioEngine.unlock();
        soundsReady++;
        if (soundsReady === 2) {
            backgroundSound.play();
            backgroundMusic.play();
        }
    }


    return scene;
}



window.addEventListener('resize', () => {
    engine.resize();
    canvasCenterY = canvas.height / 2;
    canvasCenterX = canvas.width / 2;
})

function modifySettings() {
    // canvas.addEventListener('click', () => {
    //     canvas.requestPointerLock();
    // });
}

function updateTimebar() {
    if(time>0){
        time -= 1/engine.getFps().toFixed();
        if(time.toFixed()<60){
            if(time.toFixed()<10){
                timelabel.textContent = "0:0" + time.toFixed();
            }
            else {
                timelabel.textContent = "0:" + time.toFixed();
            }
        }
        else {
            if(time.toFixed()<70){
                timelabel.textContent = "1:0" + (time-60).toFixed();
            }
            else {
                timelabel.textContent = "1:" + (time-60).toFixed();
            }
        }
        timebar.value = time;
    }
    else {
        localStorage.setItem('GameOver', '1');
        window.location.href = 'index.html';
    }
}

document.getElementById('plane').addEventListener('change', (event) => {
    if (event.currentTarget.checked) {
        mesh.material = planeWaveMaterial
    } else {
        mesh.material = planeOscillationMaterial
    }
});

var dropdown = document.getElementById("shaders");

dropdown.addEventListener("change", function() {
    var selectedOption = dropdown.options[dropdown.selectedIndex].value;
    switch (selectedOption){
        case 'fresnel':
            seashell.material = materialFresnel;
            break;
        case 'wave':
            seashell.material = materialWave;
            break;
        case 'blur':
            seashell.material = materialBlur;
            break;
    }
});

let soundStatus = document.getElementById('sound-status');

document.getElementById('sound-toggle').addEventListener('click', () => {
    if (soundStatus.innerText === "ON") {
        volume = 0;
        soundStatus.innerText = "OFF";
    } else {
        volume = 0.1;
        soundStatus.innerText = "ON";
    }
    backgroundSound.setVolume(volume);
    backgroundMusic.setVolume(volume);
    pointSound.setVolume(volume);
});