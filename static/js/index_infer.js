import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js';


// const remoteUrl = "http://34.32.228.101:8080/generate_animation"
const remoteUrl = "http://34.32.228.101:8080/generate_animation"
// 1. Set up the Scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
let meshes = [];
let mesh;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
let startAnimationTime = Date.now()
let endAnimationTime = Date.now()

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // You can experiment with different shadow map types


// Add a basic light
//const ambientLight = new THREE.AmbientLight(0xcccccc, 1);
const ambientLight = new THREE.AmbientLight(0xeeeeee, 0.5);
//const ambientLight = new THREE.AmbientLight(0xbbbbbb, 4);
scene.add(ambientLight);

//const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
const directionalLight = new THREE.DirectionalLight(0xffffff, 3); // works better
directionalLight.position.set(1, 1, 0).normalize();
scene.add(directionalLight);

// Add a PointLight
//const pointLight = new THREE.PointLight(0xffffff, 1, 100);
const pointLight = new THREE.PointLight(0xffffff, 1, 100);
pointLight.position.set(5, 5, 5); // Position is x, y, z
scene.add(pointLight);

// shadow adjustments
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024; // Default is 512
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 2.0; // Default is 0.5
directionalLight.shadow.camera.far = 500; // Default is 500

pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 1024; // Default is 512
pointLight.shadow.mapSize.height = 1024;
pointLight.shadow.camera.near = 0.1; // Default is 0.1
pointLight.shadow.camera.far = 500; // Default is 500

// display the session id
//document.addEventListener('DOMContentLoaded', () => {
    const sessionDisplay = document.getElementById('sessionDisplay');

    // Function to generate a unique 8-character identifier
    function generateShortUUID() {
        return 'xxxxxxxx'.replace(/[x]/g, function() {
            const r = Math.random() * 36 | 0;
            return r.toString(36);
        });
    }

    // Check if a session ID already exists in sessionStorage
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
        // Generate a new session ID if it doesn't exist
        sessionId = generateShortUUID();
        sessionStorage.setItem('sessionId', sessionId);
    }

    // Display the session ID
    sessionDisplay.textContent = `Session ID: ${sessionId}`;
    //console.log(sessionId);
//});

// function to get shape key coordinates
function getMorphTargetInfluence(mesh, morphTargetName) {
    const morphTargetDictionary = mesh.morphTargetDictionary;
    const morphTargetInfluences = mesh.morphTargetInfluences;

    const index = morphTargetDictionary[morphTargetName];
    if (index !== undefined) {
        //value = morphTargetInfluences[index];
        return `${morphTargetName}: ${morphTargetInfluences[index]}`;
    } else {
        console.error(`Morph target ${morphTargetName} not found`);
    }
}

// function to generate random gaussians
function getRandomGaussian(mean = 0, standardDeviation = 1) {
    let u1 = Math.random();
    let u2 = Math.random();
    let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * standardDeviation + mean;
}

// function to alter morph target influences
function setMorphTargetInfluence(mesh, morphTargetName, value) {
    const morphTargetDictionary = mesh.morphTargetDictionary;
    const morphTargetInfluences = mesh.morphTargetInfluences;

    const index = morphTargetDictionary[morphTargetName];
    if (index !== undefined) {
        morphTargetInfluences[index] = value;
        //console.log(`${morphTargetName} influence set to ${value}`);
    } else {
        console.error(`Morph target ${morphTargetName} not found`);
    }
}

// function to take a screenshot
function takeScreenshot() {
    renderer.render(scene, camera); // might be better to call animate
    const imgData = renderer.domElement.toDataURL("image/png");
    const link = document.createElement('a');
    link.href = imgData;
    let count = localStorage.getItem('fileCount');
    //link.download = `${sessionId}_image.png`;
    //link.download = 'image.png';
    link.download = `${count}_image.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// function to set a random expression
function generateFacialExpression(min, max, keys, dict, mesh, mean, variance, indices) {
    let coords = [];

    for (const key of keys) {
        let index = dict[key];
        //if (!(allowedIndices.includes(index))) {
        if (index < min | index > max ) {
            continue;
        }
        if (indices.includes(index)) {
            console.log(`Excluded key ${key} at index ${index}`);
            continue;
        }
        //console.log(`${key} at index ${morphTargetDictionary[key]}`);
        let amount = getRandomGaussian(mean, variance);
        setMorphTargetInfluence(mesh, key, amount);
        coords.push(getMorphTargetInfluence(mesh, key));
    }
    console.log('Set morph targets to new values.');
    return coords;
}

//function to save the coordinates to a file
function saveCoords(coords) {
    let jsonCoords = JSON.stringify(coords);
    let blob = new Blob([jsonCoords], { type: 'text/plain' });
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${sessionId}_coordinates.txt`;
    //link.download = 'coordinates.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function getCoord(index, dict) { 
    for (let coord in dict) {
        if (dict[coord] == index) {
            return coord;
        }
    }
}

function getKeyByValue(obj, value) {
    for (let key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] === value) {
            return key;
        }
    }
    return null; // Return null if the value is not found
}


// add event listener to take screenshots
document.getElementById('screenshotButton').addEventListener('click', takeScreenshot);

console.log(sessionId);

/*
document.getElementById('uploadForm').addEventListener('submit', (e) => {
    e.preventDefault();
})
*/

document.getElementById('runModel').addEventListener('click', () => {
    fetch('/run-script', {
        method: 'POST'
    })
    //.then(response => response.json())
    //.then(data => {
    .then(() => {
        alert("Model ran successfully.");
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while running the script.');
    });
})

// import the landmarks from the txt file
let coords;

document.addEventListener('DOMContentLoaded', () => {
    fetch('/get-file-content')
        .then(response => response.json())
        .then(data => {
            if (data.content) {
                coords = JSON.parse(data.content);
            } else {
                console.error('Error:', data.error);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
});

document.getElementById('playAnimation').addEventListener('click', () => {
    fetch('/get-file-content')
        .then(response => response.json())
        .then(data => {
            if (data.content) {
                coords = JSON.parse(data.content);
            } else {
                console.error('Error:', data.error);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
})

// 2. Load the GLB Model
const loader = new GLTFLoader();
// Assuming loader.load() has already been called
let modelPath = '/static/models/dd1.glb';
loader.load(modelPath, function (gltf) {

    const object = gltf.scene;
    meshes = object.children[0].children
    const mesh = meshes[0]; // Example: working with the first mesh
    /*
    if (mesh.morphTargetDictionary) {
        // Iterate over the morphTargetDictionary to print names and indices
        for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
            console.log(`${name}: ${index}`);
        }
    } else {
        console.log('No morph targets found on this mesh.');
    }
    */
    const morphTargetDictionary = mesh.morphTargetDictionary;
    const morphTargetInfluences = mesh.morphTargetInfluences;
    const morphTargetKeys = Object.keys(morphTargetDictionary);
    console.log("Morph Target Dictionary:", morphTargetDictionary);
    console.log("Morph Target Influences:", morphTargetInfluences);
    // indices go up to 297

   

    // ---

    const allowedIndices = [263, 279, 285];

    //coords = [[1.2, -0.5, 0.5], [1.8, -0.2, 0.8], [2.5, 0.9, 1.2], [3.6, 1.5, 1.2], [2.0, 0.8, 0.5]];

    // already imported coords above as JSON.parse
    
    let time = 1000/29.97002997002997
    console.log('CHECK FPS RATE');
    console.log(time);

    document.getElementById('playAnimation').addEventListener('click', () => {
        animateAllMeshes(coords, morphTargetDictionary, allowedIndices, time);
    })


    // ---

    animate();
    scene.add(object);


    // Compute the bounding box after adding the model to the scene
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());

    // Move the camera to focus on the center of the bounding box
    camera.position.x = center.x;
    camera.position.y = center.y;
    // Adjust the Z position based on the size of the model for a good view distance
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2));

    // Perhaps a bit far back
    camera.position.z = 30; // Adjust the 1.5 as needed

    // Update the camera's matrices
    camera.updateProjectionMatrix();

    // Point the camera to the center of the model
    camera.lookAt(center);

    // Update controls to rotate around the center of the model
    controls.target.set(center.x, center.y, center.z);
    controls.update();

}, undefined, function (error) {
    console.error(error);
});


// 3. Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);

camera.position.z = 5;

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

//animate();


// CUSTOM FUNCTIONS

function setAllMeshes(coord_vector, dict, allowedIndices) {

    for (let mesh of meshes) {
        for (let i = 0; i < coord_vector.length; i++) {
            let coord = getKeyByValue(dict, allowedIndices[i]);
            //console.log(coord);
            //let coord = getCoord(changed_indices[i], morphTargetDictionary);
            let value = coord_vector[i];
            //console.log(morphTargetDictionary[coord]);
            setMorphTargetInfluence(mesh, coord, value);

        }
    }
}

function animateAllMeshes(coordinates, dict, allowedIndices, timestep) {
    let currentAnimationIndex = 0;

    function animateNext() {
        if (currentAnimationIndex >= coordinates.length - 1) {
            console.log('ENDED ANIMATION');
            setAllMeshes(coordinates[coordinates.length - 1], dict, allowedIndices);
            return; // Exit if we've animated all coordinates
        }

        const startCoordinates = coordinates[currentAnimationIndex];
        const endCoordinates = coordinates[currentAnimationIndex + 1];
        const startTime = performance.now();

        function interpolate() {
            const elapsedTime = performance.now() - startTime;
            const progress = elapsedTime / timestep;

            if (progress < 1) {
                const interpolatedCoordinates = startCoordinates.map((startValue, i) =>
                    THREE.MathUtils.lerp(startValue, endCoordinates[i], progress)
                );
                setAllMeshes(interpolatedCoordinates, dict, allowedIndices);
                requestAnimationFrame(interpolate); // Continue interpolation
            } else {
                setAllMeshes(endCoordinates, dict, allowedIndices);

                currentAnimationIndex++; // Move to the next set of coordinates
                animateNext(); // Immediately start the next animation
            }
        }

        interpolate(); // Start interpolating the current set of coordinates
    }

    console.log('STARTED ANIMATION');
    console.log(`frames: ${coordinates.length}`);
    animateNext(); // Start the animation sequence
}
