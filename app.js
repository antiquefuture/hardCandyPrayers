// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//call the library and create new quadtree
class CustomQuadtree extends d3.quadtree {
  constructor(x, y, width, height, maxDepth, randomBias) {
    super();
    this._maxDepth = maxDepth || 0;
    this._randomBias = randomBias || 0;
    this._extent = [[x, y], [x + width, y + height]];
    this.subdivide = (node, extent, depth) => {
      if (depth === 0 || Math.random() < this._randomBias) {
        return;
      }

      const x0 = extent[0][0],
        y0 = extent[0][1],
        x1 = extent[1][0],
        y1 = extent[1][1],
        xm = (x0 + x1) / 2,
        ym = (y0 + y1) / 2;

      node.nodes = [
        { extent: [[x0, y0], [xm, ym]] },
        { extent: [[xm, y0], [x1, ym]] },
        { extent: [[x0, ym], [xm, y1]] },
        { extent: [[xm, ym], [x1, y1]] },
      ];

      for (const childNode of node.nodes) {
        this.subdivide(childNode, childNode.extent, depth - 1);
      }
    };
    this._root = { extent: this._extent };
    this.subdivide(this._root, this._extent, this._maxDepth);
  }
}
const quadtree = new CustomQuadtree(-50, -50, 100, 100, 4, 0.5);

// Set the camera position
camera.position.z = 150;

// creates new cylinder geometry if random cylinder button is pressed
function randomResizeCylinders(node) {
  if (!node.nodes) {
    const extent = node.extent;
    const width = extent[1][0] - extent[0][0];
    const height = extent[1][1] - extent[0][1];

    const buffer = 0.2;
    const newRadius = (Math.random() * width * (1 - buffer)) / 2;
    const newHeight = Math.random() * height * (1 - buffer);

    const newGeometry = new THREE.CylinderGeometry(newRadius, newRadius, newHeight, 32);
    node.userData.object.geometry.dispose(); // Dispose of old geometry
    node.userData.object.geometry = newGeometry; // Assign new geometry to the cylinder

    // Generate colors for the new geometry
    generateCylinderColors(newGeometry);

    // Update the position of the cylinder
    node.userData.object.position.set(extent[0][0] + width / 2, extent[0][1] + height / 2, newHeight / 2); // Corrected z value
  } else {
    for (const childNode of node.nodes) {
      randomResizeCylinders(childNode);
    }
  }
}

// Get the randomize cylinder button element by its ID
const randomizeButton = document.getElementById("randomizeButton");

// Add an event listener for the button click
randomizeButton.addEventListener("click", () => {
  randomResizeCylinders(quadtree._root);
});

// Function to generate colors for cylinder geometry
function generateCylinderColors(geometry) {
  const colors = [];
  const color1 = new THREE.Color(Math.random(), Math.random(), Math.random());
  const color2 = new THREE.Color(Math.random(), Math.random(), Math.random());
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    colors.push(color1.r, color1.g, color1.b);
    colors.push(color2.r, color2.g, color2.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}


// Function to create a wireframe rectangle with a random color
function createWireframeRectangle(width, height) {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 0, 0,
    width, 0, 0,
    width, height, 0,
    0, height, 0,
    0, 0, 0,
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  const color = new THREE.Color(0xffffff);
  const material = new THREE.LineBasicMaterial({ color });
  return new THREE.Line(geometry, material);
}

const cylinders = [];

// Function to create lines from the corners of the quadtree towards the camera
function createCornerLines(width, height, zDistance) {
  const lineThickness = 0.2; // Set line thickness
  const lineLength = zDistance * 1; // Set line length

  const cornerLinesGroup = new THREE.Group();

  const lineGeometry = new THREE.BoxGeometry(lineThickness, lineThickness, lineLength);
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  const positions = [
    [0, 0, -lineLength / 2],
    [width, 0, -lineLength / 2],
    [width, height, -lineLength / 2],
    [0, height, -lineLength / 2],
  ];

  positions.forEach((position) => {
    const line = new THREE.Mesh(lineGeometry, lineMaterial);
    line.position.set(...position);
    cornerLinesGroup.add(line);
  });

  return cornerLinesGroup;
}

// create the vase shapes from the points supplied
function createVase(points) {
  const geometry = new THREE.LatheGeometry(points, 32);
  generateCylinderColors(geometry);

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
  });

  const vase = new THREE.Mesh(geometry, material);

  // Get the bounding box and calculate the midpoint of the vase
  const boundingBox = new THREE.Box3().setFromObject(vase);
  const midpoint = new THREE.Vector3();
  boundingBox.getCenter(midpoint);

  // Translate the vase so that the midpoint is at the origin
  vase.geometry.translate(-midpoint.x, -midpoint.y, -midpoint.z);

  return vase;
}

function placeVasesRandomly(node) {
  if (!node.nodes) {
    if (!node.userData.object) {
      const randomNumber = Math.random();

      if (randomNumber < 0.5) {
        const points = randomizeVaseProfile();
        const vase = createVase(points);
        const extent = node.extent;
        const width = extent[1][0] - extent[0][0];
        const height = extent[1][1] - extent[0][1];
        vase.position.set(extent[0][0] + width / 2, extent[0][1] + height / 2, 0);
        vase.rotation.y = Math.random() * Math.PI * 2;
        scene.add(vase);
        node.userData.vase = vase;
      }
    }
  } else {
    for (const childNode of node.nodes) {
      placeVasesRandomly(childNode);
    }
  }
}

//create a series of points to form the vase profile
function randomizeVaseProfile() {
  const points = [];
  const numPoints = Math.floor(Math.random() * 4) + 4; // 4 to 7 points

  for (let i = 0; i < numPoints; i++) {
    const x = Math.random() * 20;
    const y = (i / (numPoints - 1)) * 100;
    points.push(new THREE.Vector2(x, y));
  }

  return points;
}
// Get the RANDOMVASE button element by its ID
const randomizeVaseButton = document.getElementById("randomizeVaseButton");

// Add an event listener for the button click
randomizeVaseButton.addEventListener("click", () => {
  randomizeAllVaseProfiles(quadtree._root);
});

function randomizeAllVaseProfiles(node) {
  if (!node.nodes) {
    if (node.userData && node.userData.object) {
      scene.remove(node.userData.object);
    }
    const extent = node.extent;
    const width = extent[1][0] - extent[0][0];
    const height = extent[1][1] - extent[0][1];
    const points = randomizeVaseProfile();
    const vase = createVase(points);

    // Scale the vase to fit inside the quadtree square
    const boundingBox = new THREE.Box3().setFromObject(vase);
    const vaseWidth = boundingBox.max.x - boundingBox.min.x;
    const vaseHeight = boundingBox.max.y - boundingBox.min.y;
    const scale = Math.min(width / vaseWidth, height / vaseHeight) * 0.8;
    vase.scale.set(scale, scale, scale);

    // Position the vase in the center of the quadtree square
    vase.position.set(extent[0][0] + width / 2, extent[0][1] + height / 2, 0);
    vase.rotation.y = Math.random() * Math.PI * 2;
    scene.add(vase);
    node.userData = { object: vase };
  } else {
    for (const childNode of node.nodes) {
      randomizeAllVaseProfiles(childNode);
    }
  }
}

function placeObjectsAndOutlines(node) {
  // Draw outline
  const extent = node.extent;
  const width = extent[1][0] - extent[0][0];
  const height = extent[1][1] - extent[0][1];
  const outline = createWireframeRectangle(width, height, 0x000000); // Change color to black
  outline.position.set(extent[0][0], extent[0][1], 0);
  scene.add(outline);

  if (!node.nodes) {
    const randomNumber = Math.random();

    if (randomNumber < 0.5) {
      // Place a cylinder
      const buffer = 0.2;
      const cylinderGeometry = new THREE.CylinderGeometry((width * (1 - buffer)) / 4, (width * (1 - buffer)) / 4, height * (1 - buffer), 32);
      const cylinderMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
      });

      generateCylinderColors(cylinderGeometry);

      const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
      cylinder.position.set(extent[0][0] + width / 2, extent[0][1] + height / 2, height * (1 - buffer) / 2);
      scene.add(cylinder);
      node.userData = { object: cylinder };
    } else {
      // Place a vase
      const points = randomizeVaseProfile();
      const vase = createVase(points);
      vase.position.set(extent[0][0] + width / 2, extent[0][1] + height / 2, 0);
      vase.rotation.y = Math.random() * Math.PI * 2;
      scene.add(vase);
      node.userData = { object: vase };
    }
  } else {
    for (const childNode of node.nodes) {
      placeObjectsAndOutlines(childNode);
    }
  }
}

// Call the function to place objects and outlines
placeObjectsAndOutlines(quadtree._root);

// Resize the vases to fit the quadtrees when they are initially created
randomizeAllVaseProfiles(quadtree._root);

// Get slider elements
const rotationSlider = document.getElementById('rotation');
const cameraZSlider = document.getElementById('camera-z');
let yRotationSpeed = parseFloat(rotationSlider.value);

// Update Y rotation speed based on slider value
rotationSlider.addEventListener('input', () => {
  yRotationSpeed = parseFloat(rotationSlider.value);
});

// Update camera position.z based on slider value
cameraZSlider.addEventListener('input', () => {
  camera.position.z = parseFloat(cameraZSlider.value);
});

// Create a single revolution counter
const revolutionCounter = { revolutions: 0, rotationY: 0 };

// Get the element to display the revolution count
const revolutionCounterElement = document.getElementById('revolution-counter');

function traverseAndRotate(node) {
  if (node.userData && node.userData.object) {
    node.userData.object.rotation.y += yRotationSpeed;

    if (node.userData.object === cylinders[0]) {
      revolutionCounter.rotationY += yRotationSpeed;
      if (revolutionCounter.rotationY >= Math.PI * 2) {
        revolutionCounter.rotationY -= Math.PI * 2;
        revolutionCounter.revolutions++;
      }
    }
  } else if (node.nodes) {
    for (const childNode of node.nodes) {
      traverseAndRotate(childNode);
    }
  }
}

// Animate the cylinders
function animate() {
  requestAnimationFrame(animate);

  traverseAndRotate(quadtree._root);

  // Update the revolution count display for the first cylinder
  revolutionCounterElement.innerHTML = ` ${revolutionCounter.revolutions} revolutions`;

  renderer.render(scene, camera);
}

animate();