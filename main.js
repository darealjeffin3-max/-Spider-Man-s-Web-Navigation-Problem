// 1. Web Audio API Setup (Ambient Wind Only)
let audioCtx = null;
let windGain = null;
let windNoiseNode = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    windNoiseNode = audioCtx.createBufferSource();
    windNoiseNode.buffer = noiseBuffer;
    windNoiseNode.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    windGain = audioCtx.createGain();
    windGain.gain.value = 0;

    windNoiseNode.connect(filter);
    filter.connect(windGain);
    windGain.connect(audioCtx.destination);
    windNoiseNode.start();
}

function playThwipSound() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
}

function playBoostSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
}

// 2. Scene & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);
scene.fog = new THREE.FogExp2(0x05070f, 0.0025);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const cameraGroup = new THREE.Group();
cameraGroup.position.set(0, 5, 0);
cameraGroup.add(camera);
scene.add(cameraGroup);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

if (document.body.firstChild) {
    document.body.insertBefore(renderer.domElement, document.body.firstChild);
} else {
    document.body.appendChild(renderer.domElement);
}

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(200, 400, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 1000;
const d = 400;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

const hemiLight = new THREE.HemisphereLight(0x00e5ff, 0x05070f, 0.5);
scene.add(hemiLight);

// 3. Dynamic GUI & Menu UI Setup (TAB Key Interface & Cancel Mission HUD)
const menuOverlay = document.createElement('div');
menuOverlay.id = 'tab-mission-menu';
menuOverlay.style.cssText = `
    display: none; position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(5, 7, 15, 0.88); backdrop-filter: blur(8px); z-index: 1000;
    flex-direction: column; align-items: center; justify-content: center;
    font-family: Arial, sans-serif; color: #fff;
`;

const menuContainer = document.createElement('div');
menuContainer.style.cssText = `
    width: 650px; background: #0d131a; border: 2px solid #00e5ff;
    border-radius: 12px; padding: 30px; box-shadow: 0 0 25px rgba(0,229,255,0.4);
    text-align: center;
`;

menuContainer.innerHTML = `
    <h1 style="margin-top: 0; color: #00e5ff; letter-spacing: 2px;">CITY MISSION SELECTOR</h1>
    <p style="color: #aaa; margin-bottom: 25px;">Select a mission category to display real-time live waypoint pathing around buildings.</p>
    <div id="category-buttons" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;"></div>
    <div id="mission-subpopup" style="display: none; margin-top: 25px; border-top: 1px solid #223; padding-top: 20px;">
        <h2 id="subpopup-title" style="margin: 0 0 15px 0; color: #ff0055;">SELECT LOCATION</h2>
        <div id="mission-locations-list" style="max-height: 200px; overflow-y: auto; text-align: left; display: flex; flex-direction: column; gap: 8px;"></div>
        <button id="close-subpopup-btn" style="margin-top: 15px; padding: 8px 16px; background: #334; border: none; color: white; border-radius: 5px; cursor: pointer;">Back to Categories</button>
    </div>
    <p style="font-size: 12px; color: #666; margin-top: 20px;">Press TAB to exit menu</p>
`;

menuOverlay.appendChild(menuContainer);
document.body.appendChild(menuOverlay);

// On-Screen Active Mission HUD Card with Cancel Option
const missionHud = document.createElement('div');
missionHud.id = 'active-mission-hud';
missionHud.style.cssText = `
    display: none; position: absolute; top: 20px; left: 20px;
    background: rgba(13, 19, 26, 0.9); border: 2px solid #00ffff;
    border-radius: 8px; padding: 12px 18px; box-shadow: 0 0 15px rgba(0,255,255,0.3);
    font-family: monospace; color: #fff; z-index: 100; min-width: 220px;
`;
missionHud.innerHTML = `
    <div style="font-size: 10px; color: #00ffff; letter-spacing: 1px;">ACTIVE ROUTE</div>
    <div id="hud-mission-title" style="font-weight: bold; font-size: 14px; margin: 4px 0; color: #ffffff;">Target #1</div>
    <div id="hud-mission-dist" style="font-size: 12px; color: #aaa; margin-bottom: 8px;">Distance: 0m</div>
    <button id="hud-cancel-btn" style="
        width: 100%; padding: 6px; background: #ff0055; border: none;
        color: white; font-weight: bold; font-size: 11px; border-radius: 4px;
        cursor: pointer; letter-spacing: 1px; transition: 0.2s;
    ">CANCEL MISSION (X)</button>
`;
document.body.appendChild(missionHud);

document.getElementById('hud-cancel-btn').onclick = () => {
    cancelCurrentMission();
};

const subpopup = document.getElementById('mission-subpopup');
const subpopupTitle = document.getElementById('subpopup-title');
const locationsList = document.getElementById('mission-locations-list');
const categoryButtonsContainer = document.getElementById('category-buttons');

// Mission Completed Right-Side Popup Notification (No Theme Jingle)
const completionPopup = document.createElement('div');
completionPopup.id = 'mission-completed-popup';
completionPopup.style.cssText = `
    display: none; position: absolute; top: 20px; right: 220px;
    background: rgba(13, 19, 26, 0.95); border: 2px solid #39ff14;
    border-radius: 8px; padding: 15px; box-shadow: 0 0 20px rgba(57,255,20,0.4);
    font-family: monospace; color: #fff; z-index: 110; width: 280px;
`;
completionPopup.innerHTML = `
    <div style="font-size: 10px; color: #39ff14; letter-spacing: 1px; font-weight: bold;">MISSION ACCOMPLISHED</div>
    <div id="completion-popup-text" style="font-size: 13px; margin: 6px 0; color: #fff; line-height: 1.3;">Target neutralized!</div>
    <div style="font-size: 11px; color: #aaa; margin-top: 8px; border-top: 1px solid #223; padding-top: 6px;">Press <strong>TAB</strong> to browse other active missions around you.</div>
`;
document.body.appendChild(completionPopup);

let completionTimeout = null;
function showCompletionNotification(missionLabel) {
    const textEl = document.getElementById('completion-popup-text');
    textEl.innerText = `${missionLabel} completed successfully!`;
    completionPopup.style.display = 'block';

    if (completionTimeout) clearTimeout(completionTimeout);
    completionTimeout = setTimeout(() => {
        completionPopup.style.display = 'none';
    }, 6000);
}

// 4. Minimap Canvas Overlay Creation
const minimapCanvas = document.createElement('canvas');
minimapCanvas.width = 180;
minimapCanvas.height = 180;
minimapCanvas.style.cssText = `
    position: absolute; top: 20px; right: 20px;
    border-radius: 50%; border: 3px solid #00e5ff;
    box-shadow: 0 0 15px rgba(0,229,255,0.4);
    background-color: rgba(5, 7, 15, 0.85); z-index: 100;
`;
document.body.appendChild(minimapCanvas);
const ctxMap = minimapCanvas.getContext('2d');

// 5. Ground Surface
const groundGeo = new THREE.PlaneGeometry(3000, 3000);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0e17, roughness: 0.9, metalness: 0.3 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(3000, 120, 0x00ffff, 0x111927);
gridHelper.position.y = 0.1;
scene.add(gridHelper);

// 6. Controls & Input Handling
const controls = new THREE.PointerLockControls(cameraGroup, document.body);
const overlay = document.getElementById('click-overlay');
let isMenuOpen = false;

function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    if (isMenuOpen) {
        controls.unlock();
        menuOverlay.style.display = 'flex';
        subpopup.style.display = 'none';
        categoryButtonsContainer.style.display = 'grid';
    } else {
        menuOverlay.style.display = 'none';
        controls.lock();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
        e.preventDefault();
        toggleMenu();
    }
    if (e.code === 'KeyX') {
        cancelCurrentMission();
    }
    if (e.code === 'KeyW') keys.w = true;
    if (e.code === 'KeyA') keys.a = true;
    if (e.code === 'KeyS') keys.s = true;
    if (e.code === 'KeyD') keys.d = true;
    if (e.code === 'Space') keys.space = true;
    if (e.code === 'KeyE') keys.e = true;
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') keys.w = false;
    if (e.code === 'KeyA') keys.a = false;
    if (e.code === 'KeyS') keys.s = false;
    if (e.code === 'KeyD') keys.d = false;
    if (e.code === 'Space') keys.space = false;
    if (e.code === 'KeyE') keys.e = false;
});

document.addEventListener('click', () => {
    if (!controls.isLocked && !isMenuOpen) controls.lock();
    initAudio();
});

if (overlay) {
    controls.addEventListener('lock', () => overlay.style.display = 'none');
    controls.addEventListener('unlock', () => {
        if (!isMenuOpen) overlay.style.display = 'flex';
    });
}

const keys = { w: false, a: false, s: false, d: false, space: false, e: false };

// 7. Expanded Spaced-Out City Generation & Grid Occupancy Matrix (Wider spacing for swinging)
const buildingObjects = [];
const buildingBoundingBoxes = [];
const colorThemes = [0x0d131a, 0x18101a, 0x101a18];
const accentColors = [0x00e5ff, 0xff0055, 0x39ff14, 0xffbb00];

const windowFrameGeo = new THREE.PlaneGeometry(2.6, 3.6);
const windowPaneGeo = new THREE.PlaneGeometry(2.2, 3.2);
const doorPanelGeo = new THREE.PlaneGeometry(5, 8);

const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x05070a, metalness: 0.9, roughness: 0.2 });
const litWindowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
const unlitWindowMat = new THREE.MeshStandardMaterial({ color: 0x101721, roughness: 0.1, metalness: 0.9 });
const doorMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide });

const frameTransforms = [];
const litPaneTransforms = [];
const unlitPaneTransforms = [];
const doorTransforms = [];

const dummy = new THREE.Object3D();

// Pathfinding & Map Boundary Grid Data Structures
const GRID_SIZE = 160;
const GRID_CELL_SIZE = 10;
const GRID_OFFSET = 800;
const gridMatrix = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));

let mapMinX = -500, mapMaxX = 500, mapMinZ = -500, mapMaxZ = 500;

function worldToGrid(x, z) {
    const gx = Math.floor((x + GRID_OFFSET) / GRID_CELL_SIZE);
    const gz = Math.floor((z + GRID_OFFSET) / GRID_CELL_SIZE);
    return {
        x: Math.max(0, Math.min(GRID_SIZE - 1, gx)),
        z: Math.max(0, Math.min(GRID_SIZE - 1, gz))
    };
}

function gridToWorld(gx, gz) {
    return {
        x: (gx * GRID_CELL_SIZE) - GRID_OFFSET + GRID_CELL_SIZE / 2,
        z: (gz * GRID_CELL_SIZE) - GRID_OFFSET + GRID_CELL_SIZE / 2
    };
}

// Generate wider spaced city layout (-600 to +600, step 110 for wide swing avenues)
for (let x = -600; x <= 600; x += 110) {
    for (let z = -600; z <= 600; z += 110) {
        if (Math.abs(x) < 50 && Math.abs(z) < 50) continue;

        const height = 90 + Math.random() * 150;
        const width = 35 + Math.random() * 20;
        const depth = 35 + Math.random() * 20;

        if (x - width/2 < mapMinX) mapMinX = x - width/2;
        if (x + width/2 > mapMaxX) mapMaxX = x + width/2;
        if (z - depth/2 < mapMinZ) mapMinZ = z - depth/2;
        if (z + depth/2 > mapMaxZ) mapMaxZ = z + depth/2;

        const themeColor = colorThemes[Math.floor(Math.random() * colorThemes.length)];
        const accentHex = accentColors[Math.floor(Math.random() * accentColors.length)];

        const geo = new THREE.BoxGeometry(width, height, depth);
        const buildingMat = new THREE.MeshStandardMaterial({ color: themeColor, roughness: 0.4, metalness: 0.6 });
        const building = new THREE.Mesh(geo, buildingMat);
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        buildingObjects.push(building);

        const bbox = new THREE.Box3().setFromObject(building);
        buildingBoundingBoxes.push({ box: bbox, width, depth, height, x, z });

        const minG = worldToGrid(x - width / 2 - 5, z - depth / 2 - 5);
        const maxG = worldToGrid(x + width / 2 + 5, z + depth / 2 + 5);

        for (let gx = minG.x; gx <= maxG.x; gx++) {
            for (let gz = minG.z; gz <= maxG.z; gz++) {
                gridMatrix[gx][gz] = true;
            }
        }

        const edges = new THREE.EdgesGeometry(geo);
        const wireframe = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: accentHex, linewidth: 2 }));
        building.add(wireframe);

        const faces = [
            { normal: new THREE.Vector3(0, 0, 1), offsetZ: depth / 2 + 0.1, offsetX: 0, rotY: 0, size: width },
            { normal: new THREE.Vector3(0, 0, -1), offsetZ: -depth / 2 - 0.1, offsetX: 0, rotY: Math.PI, size: width },
            { normal: new THREE.Vector3(1, 0, 0), offsetZ: 0, offsetX: width / 2 + 0.1, rotY: Math.PI / 2, size: depth },
            { normal: new THREE.Vector3(-1, 0, 0), offsetZ: 0, offsetX: -width / 2 - 0.1, rotY: -Math.PI / 2, size: depth }
        ];

        faces.forEach(face => {
            const cols = Math.floor((face.size - 6) / 5);
            const rows = Math.floor((height - 16) / 7);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const posX = -((cols - 1) * 5) / 2 + c * 5;
                    const posY = height / 2 - 10 - r * 7;

                    dummy.rotation.set(0, face.rotY, 0);

                    if (face.normal.z !== 0) {
                        dummy.position.set(x + posX, posY, z + face.offsetZ);
                    } else {
                        dummy.position.set(x + face.offsetX, posY, z + posX);
                    }
                    dummy.updateMatrix();
                    frameTransforms.push(dummy.matrix.clone());

                    const pushOffset = (face.normal.z !== 0) ? (face.normal.z > 0 ? 0.05 : -0.05) : (face.normal.x > 0 ? 0.05 : -0.05);
                    if (face.normal.z !== 0) {
                        dummy.position.set(x + posX, posY, z + face.offsetZ + pushOffset);
                    } else {
                        dummy.position.set(x + face.offsetX + pushOffset, posY, z + posX);
                    }
                    dummy.updateMatrix();

                    if (Math.random() > 0.35) {
                        litPaneTransforms.push(dummy.matrix.clone());
                    } else {
                        unlitPaneTransforms.push(dummy.matrix.clone());
                    }
                }
            }
        });

        dummy.position.set(x, 4, z + depth / 2 + 0.2);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        doorTransforms.push(dummy.matrix.clone());
    }
}

function createInstancedMesh(geo, mat, matrices) {
    const instancedMesh = new THREE.InstancedMesh(geo, mat, matrices.length);
    for (let i = 0; i < matrices.length; i++) {
        instancedMesh.setMatrixAt(i, matrices[i]);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    scene.add(instancedMesh);
}

createInstancedMesh(windowFrameGeo, windowFrameMat, frameTransforms);
createInstancedMesh(windowPaneGeo, litWindowMat, litPaneTransforms);
createInstancedMesh(windowPaneGeo, unlitWindowMat, unlitPaneTransforms);
createInstancedMesh(doorPanelGeo, doorMat, doorTransforms);

// 8. Event Generation & Interactive Selection UI
const cityEvents = [];
const eventCategories = [
    { type: 'EMERGENCY', color: 0xff0055, hexStr: '#ff0055', label: 'Emergency' },
    { type: 'CIVILIAN', color: 0x00e5ff, hexStr: '#00e5ff', label: 'Civilian in Danger' },
    { type: 'VILLAIN', color: 0xffbb00, hexStr: '#ffbb00', label: 'Villain Ambush' },
    { type: 'DESTINATION', color: 0x39ff14, hexStr: '#39ff14', label: 'Destination Point' }
];

const eventGeo = new THREE.OctahedronGeometry(2.5, 0);
const labelsContainer = document.createElement('div');
labelsContainer.style.cssText = 'position: absolute; top: 0; left: 0; pointer-events: none; width: 100vw; height: 100vh; overflow: hidden; z-index: 10;';
document.body.appendChild(labelsContainer);

let globalEventIdCounter = 1;

function spawnNewEvent(specificConfig = null) {
    const config = specificConfig || eventCategories[Math.floor(Math.random() * eventCategories.length)];
    const rx = (Math.random() - 0.5) * 1000;
    const rz = (Math.random() - 0.5) * 1000;
    const ry = 6 + Math.random() * 90;

    const eventMat = new THREE.MeshBasicMaterial({ color: config.color, wireframe: true });
    const eventMesh = new THREE.Mesh(eventGeo, eventMat);
    eventMesh.position.set(rx, ry, rz);
    scene.add(eventMesh);

    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = `
        position: absolute; color: ${config.hexStr}; font-family: monospace;
        font-weight: bold; font-size: 11px; background: rgba(5, 7, 15, 0.75);
        padding: 2px 6px; border: 1px solid ${config.hexStr}; border-radius: 4px;
        transform: translate(-50%, -100%); white-space: nowrap;
    `;
    labelsContainer.appendChild(labelDiv);

    const newEv = {
        id: globalEventIdCounter++,
        mesh: eventMesh,
        type: config.type,
        color: config.hexStr,
        label: config.label,
        pos: new THREE.Vector3(rx, ry, rz),
        labelEl: labelDiv
    };
    cityEvents.push(newEv);
    return newEv;
}

for (let i = 0; i < 50; i++) {
    spawnNewEvent();
}

// 9. A* Pathfinding Engine & Solid Glowing Line Renderer (Live Updating)
let activeTargetEvent = null;
let currentPathPoints = [];
let pathRecalculateTimer = 0;

const pathMaterial = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    linewidth: 5,
    transparent: true,
    opacity: 0.95
});
const pathGeometry = new THREE.BufferGeometry();
const pathLine = new THREE.Line(pathGeometry, pathMaterial);
scene.add(pathLine);
pathLine.visible = false;

function cancelCurrentMission() {
    activeTargetEvent = null;
    currentPathPoints = [];
    pathLine.visible = false;
    missionHud.style.display = 'none';
}

function findPathAroundBuildings(startPos, targetPos) {
    const startG = worldToGrid(startPos.x, startPos.z);
    const targetG = worldToGrid(targetPos.x, targetPos.z);

    const openSet = [];
    const closedSet = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));
    const parentMap = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));

    const gScore = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(Infinity));
    const fScore = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(Infinity));

    gScore[startG.x][startG.z] = 0;
    fScore[startG.x][startG.z] = Math.hypot(targetG.x - startG.x, targetG.z - startG.z);
    openSet.push(startG);

    while (openSet.length > 0) {
        openSet.sort((a, b) => fScore[a.x][a.z] - fScore[b.x][b.z]);
        const current = openSet.shift();

        if (current.x === targetG.x && current.z === targetG.z) {
            const rawPath = [];
            let currNode = current;
            while (currNode) {
                rawPath.push(gridToWorld(currNode.x, currNode.z));
                currNode = parentMap[currNode.x][currNode.z];
            }
            return rawPath.reverse();
        }

        closedSet[current.x][current.z] = true;

        const neighbors = [
            { x: current.x + 1, z: current.z }, { x: current.x - 1, z: current.z },
            { x: current.x, z: current.z + 1 }, { x: current.x, z: current.z - 1 },
            { x: current.x + 1, z: current.z + 1 }, { x: current.x - 1, z: current.z - 1 },
            { x: current.x + 1, z: current.z - 1 }, { x: current.x - 1, z: current.z + 1 }
        ];

        for (let n of neighbors) {
            if (n.x < 0 || n.x >= GRID_SIZE || n.z < 0 || n.z >= GRID_SIZE) continue;
            if (gridMatrix[n.x][n.z] && !(n.x === targetG.x && n.z === targetG.z)) continue;
            if (closedSet[n.x][n.z]) continue;

            const distStep = (n.x !== current.x && n.z !== current.z) ? 1.414 : 1.0;
            const tentativeG = gScore[current.x][current.z] + distStep;

            if (tentativeG < gScore[n.x][n.z]) {
                parentMap[n.x][n.z] = current;
                gScore[n.x][n.z] = tentativeG;
                fScore[n.x][n.z] = tentativeG + Math.hypot(targetG.x - n.x, targetG.z - n.z);

                if (!openSet.some(item => item.x === n.x && item.z === n.z)) {
                    openSet.push(n);
                }
            }
        }
    }

    return [{ x: startPos.x, z: startPos.z }, { x: targetPos.x, z: targetPos.z }];
}

function updateLiveWaypointPath() {
    if (!activeTargetEvent) return;

    const waypoints = findPathAroundBuildings(cameraGroup.position, activeTargetEvent.pos);
    currentPathPoints = waypoints;

    const points = [new THREE.Vector3(cameraGroup.position.x, 2.5, cameraGroup.position.z)];
    waypoints.forEach(w => points.push(new THREE.Vector3(w.x, 3.5, w.z)));
    points.push(activeTargetEvent.pos.clone());

    pathGeometry.setFromPoints(points);
    pathGeometry.computeBoundingSphere();
    pathLine.visible = true;

    const dist = Math.round(cameraGroup.position.distanceTo(activeTargetEvent.pos));
    document.getElementById('hud-mission-title').innerText = `${activeTargetEvent.label} #${activeTargetEvent.id}`;
    document.getElementById('hud-mission-title').style.color = activeTargetEvent.color;
    document.getElementById('hud-mission-dist').innerText = `Distance: ${dist}m`;
    missionHud.style.display = 'block';
}

function startMission(ev) {
    activeTargetEvent = ev;
    updateLiveWaypointPath();
    toggleMenu();

    const randomStartMsg = missionStartDialogues[Math.floor(Math.random() * missionStartDialogues.length)];
    triggerSpideyComms(randomStartMsg);
}

// Populate TAB Category Buttons
eventCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.style.cssText = `
        padding: 15px; background: #161f2c; border: 2px solid ${cat.hexStr};
        color: ${cat.hexStr}; font-weight: bold; font-size: 16px;
        border-radius: 8px; cursor: pointer; transition: 0.2s;
    `;
    btn.innerText = cat.label;
    btn.onclick = () => showMissionSubpopup(cat);
    categoryButtonsContainer.appendChild(btn);
});

function showMissionSubpopup(cat) {
    categoryButtonsContainer.style.display = 'none';
    subpopup.style.display = 'block';
    subpopupTitle.innerText = `${cat.label.toUpperCase()} LOCATIONS`;
    subpopupTitle.style.color = cat.hexStr;
    locationsList.innerHTML = '';

    const matchingEvents = cityEvents.filter(e => e.type === cat.type);

    if (matchingEvents.length === 0) {
        locationsList.innerHTML = '<div style="color: #aaa; padding: 10px;">No active locations right now. Check back soon!</div>';
        return;
    }

    matchingEvents.forEach(ev => {
        const dist = Math.round(cameraGroup.position.distanceTo(ev.pos));
        const item = document.createElement('div');
        item.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            background: #101721; padding: 10px 15px; border-radius: 5px;
            border-left: 4px solid ${cat.hexStr};
        `;
        item.innerHTML = `
            <span><strong>${cat.label} #${ev.id}</strong> - Pos: (${Math.round(ev.pos.x)}, ${Math.round(ev.pos.z)})</span>
            <span style="color: #aaa; margin-right: 15px;">${dist}m away</span>
            <button style="padding: 5px 12px; background: ${cat.hexStr}; color: #000; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">SELECT</button>
        `;

        item.querySelector('button').onclick = () => {
            startMission(ev);
        };

        locationsList.appendChild(item);
    });
}

document.getElementById('close-subpopup-btn').onclick = () => {
    subpopup.style.display = 'none';
    categoryButtonsContainer.style.display = 'grid';
};

// 10. Spider-Man Communicator HUD Popup & Dialogue System
const commsPopup = document.createElement('div');
commsPopup.id = 'spidey-comms-hud';
commsPopup.style.cssText = `
    display: none; position: absolute; bottom: 30px; right: 30px;
    width: 340px; background: rgba(13, 19, 26, 0.92); border: 2px solid #ff0055;
    border-radius: 12px; padding: 15px; box-shadow: 0 0 20px rgba(255,0,85,0.4);
    font-family: Arial, sans-serif; color: #fff; z-index: 105;
    align-items: center; gap: 15px;
`;

commsPopup.innerHTML = `
    <div style="
        width: 60px; height: 60px; min-width: 60px; border-radius: 50%;
        background: #161f2c; border: 2px solid #00e5ff; overflow: hidden;
        display: flex; align-items: center; justify-content: center; position: relative;
    ">
        <svg viewBox="0 0 100 100" style="width: 50px; height: 50px;">
            <circle cx="50" cy="50" r="46" fill="#ff0055"/>
            <path d="M 50 4 L 50 96 M 4 50 L 96 50 M 18 18 L 82 82 M 18 82 L 82 18" stroke="#880022" stroke-width="2"/>
            <path d="M 50 15 Q 65 30 85 30 M 50 15 Q 35 30 15 30 M 50 85 Q 65 70 85 70 M 50 85 Q 35 70 15 70" fill="none" stroke="#880022" stroke-width="1.5"/>
            <path d="M 24 45 Q 38 32 45 48 Q 38 60 24 45 Z" fill="#ffffff" stroke="#000" stroke-width="2"/>
            <path d="M 76 45 Q 62 32 55 48 Q 62 60 76 45 Z" fill="#ffffff" stroke="#000" stroke-width="2"/>
        </svg>
    </div>
    <div style="flex-grow: 1; overflow: hidden;">
        <div style="font-size: 10px; color: #00e5ff; letter-spacing: 1px; font-weight: bold;">SECURE COMMS // SPIDER-MAN</div>
        <div id="comms-dialogue-text" style="font-size: 13px; color: #fff; margin-top: 4px; line-height: 1.3;">Hey, just checking your route. Keep moving!</div>
    </div>
`;
document.body.appendChild(commsPopup);

const spideyDialogues = [
    "Did you just face-plant into that billboard? Because telemetry says yes, and honestly, oof.",
    "Hey, quick tip: gravity is undefeated. Maybe try not fighting it so hard?",
    "Are you web-swinging or just dramatically falling with style? Asking for a friend.",
    "Your swinging rhythm looks like a wet noodle in a wind tunnel. Let's work on that.",
    "If clumsy was a superpower, you'd be an Avenger by now. Keep going though!",
    "Was that building moving or did you just seek it out like a heat-seeking missile?",
    "Got your live GPS synced up. Try not to crash into any more pigeons.",
    "Nice swing! Well, 'nice' is a strong word... let's go with 'courageous'.",
    "Look at you go! Like a graceful falcon... if a falcon was made of pure panic.",
    "Remember: with great power comes a really high laundry bill for your spandex."
];

const missionStartDialogues = [
    "Route locked in! Go show 'em how a real hero trips over their own shoelaces!",
    "Mission accepted. Try not to get lost between here and the target, okay?",
    "Coordinates received! The glowing line won't hold your hand, but it's close.",
    "Let's roll! Try to arrive in one piece this time."
];

let commsTimeout = null;
function triggerSpideyComms(customText = null) {
    const textEl = document.getElementById('comms-dialogue-text');
    if (!textEl) return;

    if (customText) {
        textEl.innerText = customText;
    } else {
        const randomIndex = Math.floor(Math.random() * spideyDialogues.length);
        textEl.innerText = spideyDialogues[randomIndex];
    }

    commsPopup.style.display = 'flex';

    if (commsTimeout) clearTimeout(commsTimeout);
    commsTimeout = setTimeout(() => {
        commsPopup.style.display = 'none';
    }, 4500);
}

function scheduleRandomComms() {
    const randomDelay = (25 + Math.random() * 20) * 1000;
    setTimeout(() => {
        if (!isMenuOpen) {
            triggerSpideyComms();
        }
        scheduleRandomComms();
    }, randomDelay);
}
scheduleRandomComms();

// 11. Octagonal Web Anchor Mesh Construction
function createOctagonalWebGeometry(radius = 3.5, rings = 3) {
    const points = [];
    const numSides = 8;
    const angleStep = (Math.PI * 2) / numSides;

    for (let r = 1; r <= rings; r++) {
        const ringRadius = (radius / rings) * r;
        for (let i = 0; i < numSides; i++) {
            const a1 = i * angleStep;
            const a2 = (i + 1) * angleStep;

            points.push(new THREE.Vector3(Math.cos(a1) * ringRadius, Math.sin(a1) * ringRadius, 0));
            points.push(new THREE.Vector3(Math.cos(a2) * ringRadius, Math.sin(a2) * ringRadius, 0));
        }
    }

    for (let i = 0; i < numSides; i++) {
        const angle = i * angleStep;
        points.push(new THREE.Vector3(0, 0, 0));
        points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }

    return new THREE.BufferGeometry().setFromPoints(points);
}

const octagonalWebGeo = createOctagonalWebGeometry(3.5, 3);
const octagonalWebMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3, transparent: true, opacity: 0.95 });
const webDecalMesh = new THREE.LineSegments(octagonalWebGeo, octagonalWebMat);
webDecalMesh.visible = false;
scene.add(webDecalMesh);

// Target Indicator Ring
const ringGeo = new THREE.RingGeometry(1.2, 2.2, 32);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0055, side: THREE.DoubleSide, depthTest: false });
const targetMarker = new THREE.Mesh(ringGeo, ringMat);
targetMarker.visible = false;
scene.add(targetMarker);

// State Variables
let velocity = new THREE.Vector3(0, 0, 0);
let isSwinging = false;
let isWallRunning = false;
let swingTarget = null;
let currentHitNormal = null;
let webRestLength = 0;
let isGrounded = false;

// Web Line
const webMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
const webGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const webLine = new THREE.Line(webGeometry, webMaterial);
scene.add(webLine);
webLine.visible = false;

const raycaster = new THREE.Raycaster();
const crosshair = document.getElementById('crosshair');
let currentHitPoint = null;

// Mouse Controls
document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && currentHitPoint && controls.isLocked && !isMenuOpen) {
        isSwinging = true;
        swingTarget = currentHitPoint.clone();
        webRestLength = cameraGroup.position.distanceTo(swingTarget) * 0.85;
        webLine.visible = true;

        if (currentHitNormal) {
            webDecalMesh.position.copy(currentHitPoint).add(currentHitNormal.clone().multiplyScalar(0.08));
            webDecalMesh.lookAt(currentHitPoint.clone().add(currentHitNormal));
            webDecalMesh.visible = true;
        }

        playThwipSound();
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0 && isSwinging) {
        isSwinging = false;
        webLine.visible = false;
        webDecalMesh.visible = false;

        const speed = velocity.length();
        if (speed > 5) {
            velocity.x *= 1.35;
            velocity.z *= 1.35;
            velocity.y += Math.max(12, velocity.y * 0.4);
            playBoostSound();
        }
    }
});

const clock = new THREE.Clock();
const tempVec = new THREE.Vector3();

// Map boundary limits (Allowed up to 90m beyond outermost buildings)
const borderMargin = 90;
const absoluteMinX = mapMinX - borderMargin;
const absoluteMaxX = mapMaxX + borderMargin;
const absoluteMinZ = mapMinZ - borderMargin;
const absoluteMaxZ = mapMaxZ + borderMargin;

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    // Dynamic Live Recalculation for Pathing as Player Moves
    if (activeTargetEvent) {
        pathRecalculateTimer += delta;
        if (pathRecalculateTimer > 0.15) {
            updateLiveWaypointPath();
            pathRecalculateTimer = 0;
        }
    }

    // 1. Target Raycasting
    const cameraWorldDir = new THREE.Vector3();
    camera.getWorldDirection(cameraWorldDir);

    raycaster.set(cameraGroup.position, cameraWorldDir);
    const intersects = raycaster.intersectObjects(buildingObjects);

    if (intersects.length > 0 && intersects[0].distance < 250) {
        const hit = intersects[0];
        currentHitPoint = hit.point;
        currentHitNormal = hit.face.normal.clone();

        targetMarker.position.copy(hit.point).add(hit.face.normal.clone().multiplyScalar(0.1));
        targetMarker.lookAt(hit.point.clone().add(hit.face.normal));
        targetMarker.visible = true;

        if (crosshair) crosshair.classList.add('locked');
        const targetInfo = document.getElementById('target-info');
        if (targetInfo) targetInfo.innerText = 'TARGET: SURFACE LOCKED';
    } else {
        currentHitPoint = null;
        currentHitNormal = null;
        targetMarker.visible = false;
        if (crosshair) crosshair.classList.remove('locked');
        const targetInfo = document.getElementById('target-info');
        if (targetInfo) targetInfo.innerText = 'TARGET: NONE';
    }

    // 2. Key-Based Wall Sticking ('E' Key)
    let wallNormal = null;
    if (!isGrounded && keys.e) {
        const checkDirs = [
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
        ];
        for (let dir of checkDirs) {
            const wallRay = new THREE.Raycaster(cameraGroup.position, dir, 0, 3.0);
            const wallHits = wallRay.intersectObjects(buildingObjects);
            if (wallHits.length > 0) {
                wallNormal = wallHits[0].face.normal.clone();
                break;
            }
        }
    }

    isWallRunning = (wallNormal !== null && keys.e && !isGrounded);

    // 3. Physics & Movement
    if (!isMenuOpen) {
        const moveDir = new THREE.Vector3();
        const forward = new THREE.Vector3();
        const side = new THREE.Vector3();
        const upVector = new THREE.Vector3(0, 1, 0);

        cameraGroup.getWorldDirection(forward);
        forward.negate();
        forward.y = 0;
        forward.normalize();
        side.crossVectors(upVector, forward).negate().normalize();

        if (keys.w) moveDir.add(forward);
        if (keys.s) moveDir.sub(forward);
        if (keys.d) moveDir.sub(side);
        if (keys.a) moveDir.add(side);
        moveDir.normalize();

        if (isWallRunning) {
            if (keys.w) velocity.y = 20;
            else if (keys.s) velocity.y = -20;
            else velocity.y = 0;

            camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0.08, 0.1);
            if (keys.space) {
                velocity.addScaledVector(wallNormal, 24);
                velocity.y = 20;
            }
        } else {
            camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0, 0.1);
            velocity.y -= 38 * delta;

            const walkAccel = isGrounded ? 80 : 25;
            if (moveDir.length() > 0) {
                velocity.x += moveDir.x * walkAccel * delta;
                velocity.z += moveDir.z * walkAccel * delta;
            }

            if (keys.space && isGrounded) {
                velocity.y = 18;
                isGrounded = false;
            }
        }

        // Pendulum Swing Dynamics
        if (isSwinging && swingTarget) {
            let dist = cameraGroup.position.distanceTo(swingTarget);
            if (dist > webRestLength) {
                let pullDir = new THREE.Vector3().subVectors(swingTarget, cameraGroup.position).normalize();
                let pullForce = (dist - webRestLength) * 20;
                velocity.addScaledVector(pullDir, pullForce * delta);
            }

            const positions = webLine.geometry.attributes.position.array;
            positions[0] = cameraGroup.position.x;
            positions[1] = cameraGroup.position.y - 1;
            positions[2] = cameraGroup.position.z;
            positions[3] = swingTarget.x;
            positions[4] = swingTarget.y;
            positions[5] = swingTarget.z;
            webLine.geometry.attributes.position.needsUpdate = true;
        }

        cameraGroup.position.addScaledVector(velocity, delta);

        // Strict Map Border Enforcement
        if (cameraGroup.position.x < absoluteMinX) {
            cameraGroup.position.x = absoluteMinX;
            velocity.x = Math.max(0, velocity.x);
        } else if (cameraGroup.position.x > absoluteMaxX) {
            cameraGroup.position.x = absoluteMaxX;
            velocity.x = Math.min(0, velocity.x);
        }

        if (cameraGroup.position.z < absoluteMinZ) {
            cameraGroup.position.z = absoluteMinZ;
            velocity.z = Math.max(0, velocity.z);
        } else if (cameraGroup.position.z > absoluteMaxZ) {
            cameraGroup.position.z = absoluteMaxZ;
            velocity.z = Math.min(0, velocity.z);
        }
    }

    // Dynamic Event Animations & Proximity Completion Checks
    for (let i = cityEvents.length - 1; i >= 0; i--) {
        const ev = cityEvents[i];
        ev.mesh.rotation.y += 1.5 * delta;
        ev.mesh.rotation.x += 0.8 * delta;

        const distanceToEvent = cameraGroup.position.distanceTo(ev.pos);

        if (distanceToEvent >= 25 && distanceToEvent <= 50) {
            const finishedLabel = `${ev.label} #${ev.id}`;
            showCompletionNotification(finishedLabel);

            scene.remove(ev.mesh);
            ev.mesh.geometry.dispose();
            if (ev.mesh.material) ev.mesh.material.dispose();
            ev.labelEl.remove();

            cityEvents.splice(i, 1);

            if (activeTargetEvent === ev) {
                cancelCurrentMission();
            }

            const originalCatType = ev.type;
            const matchingCat = eventCategories.find(c => c.type === originalCatType) || eventCategories[0];
            spawnNewEvent(matchingCat);

            continue;
        }

        tempVec.copy(ev.pos);
        tempVec.y += 3.5;
        tempVec.project(camera);

        const dist = Math.round(distanceToEvent);
        const isBehind = tempVec.z > 1;

        if (isBehind || dist > 350) {
            ev.labelEl.style.display = 'none';
        } else {
            const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;
            ev.labelEl.style.display = 'block';
            ev.labelEl.style.left = `${x}px`;
            ev.labelEl.style.top = `${y}px`;
            ev.labelEl.innerText = `${ev.label} (${dist}m)`;
        }
    }

    // 4. Building & Collision Checks
    const playerRadius = 1.2;
    const playerPos = cameraGroup.position;
    let standingOnRoof = false;

    for (let b of buildingBoundingBoxes) {
        const roofHeight = b.height + 4;

        if (playerPos.x > b.x - b.width / 2 - playerRadius &&
            playerPos.x < b.x + b.width / 2 + playerRadius &&
            playerPos.z > b.z - b.depth / 2 - playerRadius &&
            playerPos.z < b.z + b.depth / 2 + playerRadius) {

            if (playerPos.y <= roofHeight && playerPos.y >= b.height - 2 && velocity.y <= 0) {
                playerPos.y = roofHeight;
                velocity.y = 0;
                isGrounded = true;
                standingOnRoof = true;
            } else if (playerPos.y < b.height - 2) {
                const minX = b.x - b.width / 2 - playerRadius;
                const maxX = b.x + b.width / 2 + playerRadius;
                const minZ = b.z - b.depth / 2 - playerRadius;
                const maxZ = b.z + b.depth / 2 + playerRadius;

                const pushLeft = playerPos.x - minX;
                const pushRight = maxX - playerPos.x;
                const pushBack = playerPos.z - minZ;
                const pushFront = maxZ - playerPos.z;

                const minPush = Math.min(pushLeft, pushRight, pushBack, pushFront);

                if (minPush === pushLeft) { playerPos.x = minX; velocity.x = Math.min(0, velocity.x); }
                else if (minPush === pushRight) { playerPos.x = maxX; velocity.x = Math.max(0, velocity.x); }
                else if (minPush === pushBack) { playerPos.z = minZ; velocity.z = Math.max(0, velocity.z); }
                else if (minPush === pushFront) { playerPos.z = maxZ; velocity.z = Math.max(0, velocity.z); }
            }
        }
    }

    // Ground & Friction
    if (cameraGroup.position.y <= 3) {
        cameraGroup.position.y = 3;
        velocity.y = 0;
        isGrounded = true;
        velocity.x *= 0.88;
        velocity.z *= 0.88;
    } else if (standingOnRoof) {
        velocity.x *= 0.88;
        velocity.z *= 0.88;
    } else if (!isWallRunning) {
        velocity.x *= 0.995;
        velocity.z *= 0.995;
    }

    // HUD Update
    const speed = Math.round(velocity.length() * 2.237);
    const speedInfo = document.getElementById('speed-info');
    if (speedInfo) speedInfo.innerText = `SPEED: ${speed} MPH`;

    if (windGain) {
        const targetGain = Math.min(speed / 80, 0.6);
        windGain.gain.setValueAtTime(targetGain, audioCtx.currentTime);
    }

    // Render Main 3D Scene
    renderer.render(scene, camera);

    // 5. Render Live Minimap View with Active Waypoint Path
    ctxMap.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    const mapCenter = 90;
    const mapScale = 0.35;

    ctxMap.save();
    ctxMap.translate(mapCenter, mapCenter);

    // Draw Buildings
    ctxMap.fillStyle = 'rgba(255, 255, 255, 0.15)';
    buildingBoundingBoxes.forEach(b => {
        const dx = (b.x - cameraGroup.position.x) * mapScale;
        const dz = (b.z - cameraGroup.position.z) * mapScale;
        const w = b.width * mapScale;
        const h = b.depth * mapScale;

        if (Math.abs(dx) < 85 && Math.abs(dz) < 85) {
            ctxMap.fillRect(dx - w / 2, dz - h / 2, w, h);
        }
    });

    // Draw Active Path Lines on Minimap
    if (pathLine.visible && currentPathPoints.length > 0) {
        ctxMap.beginPath();
        ctxMap.strokeStyle = '#00ffff';
        ctxMap.lineWidth = 3;

        currentPathPoints.forEach((pt, idx) => {
            const dx = (pt.x - cameraGroup.position.x) * mapScale;
            const dz = (pt.z - cameraGroup.position.z) * mapScale;
            if (idx === 0) ctxMap.moveTo(dx, dz);
            else ctxMap.lineTo(dx, dz);
        });
        ctxMap.stroke();
    }

    // Draw Map Event Markers
    cityEvents.forEach(ev => {
        const dx = (ev.pos.x - cameraGroup.position.x) * mapScale;
        const dz = (ev.pos.z - cameraGroup.position.z) * mapScale;

        if (Math.abs(dx) < 85 && Math.abs(dz) < 85) {
            ctxMap.beginPath();
            ctxMap.arc(dx, dz, 3.5, 0, Math.PI * 2);
            ctxMap.fillStyle = ev.color;
            ctxMap.fill();
        }
    });

    // Draw Player Arrow Pointer
    ctxMap.rotate(-cameraGroup.rotation.y);
    ctxMap.beginPath();
    ctxMap.moveTo(0, -6);
    ctxMap.lineTo(5, 5);
    ctxMap.lineTo(-5, 5);
    ctxMap.closePath();
    ctxMap.fillStyle = '#ff0055';
    ctxMap.fill();

    ctxMap.restore();
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});