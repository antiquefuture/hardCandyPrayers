// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

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

const quadtree = new CustomQuadtree(-50, -50, 100, 100, 8, 0.5);

function randomResizeCylinders(node) {
  if (!node.nodes) {
    const extent = node.extent;
    const width = extent[1][0] - extent[0][0];
    const height = extent[1][1] - extent[0][1];

    const buffer = 0.2;
    const newRadius = (Math.random() * width * (1 - buffer)) / 2;
    const newHeight = Math.random() * height * (1 - buffer);

    const newGeometry = new THREE.CylinderGeometry(newRadius, newRadius, newHeight, 32);
    node.userData.cylinder.geometry.dispose(); // Dispose of old geometry
    node.userData.cylinder.geometry = newGeometry; // Assign new geometry to the cylinder

    // Generate colors for the new geometry
    generateCylinderColors(newGeometry);

    // Update the position of the cylinder
    node.userData.cylinder.position.set(extent[0][0] + width / 2, extent[0][1] + height / 2, newHeight / 2 - newHeight / 2); // Set z value to 0
  } else {
    for (const childNode of node.nodes) {
      randomResizeCylinders(childNode);
    }
  }
}

// Get the button element by its ID
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

function adjustQuadtree(node, factor) {
  const extent = node.extent;
  const width = extent[1][0] - extent[0][0];
  const height = extent[1][1] - extent[0][1];

  if (node.nodes) {
    for (const childNode of node.nodes) {
      adjustQuadtree(childNode, factor);
    }
  } else {
    // Update the size of the cylinder
    const buffer = 0.2;
    const radius = (width * (1 - buffer)) / 4 * factor;
    const newGeometry = new THREE.CylinderGeometry(radius, radius, height * (1 - buffer), 32);
    node.userData.cylinder.geometry.dispose(); // Dispose of old geometry
    node.userData.cylinder.geometry = newGeometry; // Assign new geometry to the cylinder
  }

  // Adjust the Quadtree grid size
  node.extent = [
    [extent[0][0] * factor, extent[0][1] * factor],
    [extent[1][0] * factor, extent[1][1] * factor]
  ];

  // Update the position and size of the outline
  const outline = node.userData && node.userData.outline;
  if (outline) {
    const newOutline = createWireframeRectangle(width * factor, height * factor, 0x000000);
    newOutline.position.set(extent[0][0] * factor, extent[0][1] * factor, 0);
    scene.remove(outline);
    scene.add(newOutline);
    node.userData.outline = newOutline;
  }
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

function placeCylindersAndOutlines(node) {
  if (!node.nodes) {
    const extent = node.extent;
    const width = extent[1][0] - extent[0][0];
    const height = extent[1][1] - extent[0][1];
    const buffer = 0.2;
    const cylinderGeometry = new THREE.CylinderGeometry((width * (1 - buffer)) / 4, (width * (1 - buffer)) / 4, height * (1 - buffer), 32);
    const cylinderMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
    });

     generateCylinderColors(cylinderGeometry);

    const colors = [];
    const color1 = new THREE.Color(Math.random(), Math.random(), Math.random());
    const color2 = new THREE.Color(Math.random(), Math.random(), Math.random());
    for (let i = 0; i < cylinderGeometry.attributes.position.count; i++) {
      colors.push(color1.r, color1.g, color1.b);
      colors.push(color2.r, color2.g, color2.b);
    }
    cylinderGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.position.set(extent[0][0] + width / 2, extent[0][1] + height / 2, 0);
    scene.add(cylinder);
    node.userData = { cylinder: cylinder };

    // Draw solid rectangle with random color and opacity
    const rectangleGeometry = new THREE.PlaneGeometry(width, height);
    const rectangleColor = new THREE.Color(Math.random(), Math.random(), Math.random());
    const rectangleOpacity = Math.random();
    const rectangleMaterial = new THREE.MeshBasicMaterial({ color: rectangleColor, opacity: rectangleOpacity, transparent: true, side: THREE.DoubleSide });
    const rectangle = new THREE.Mesh(rectangleGeometry, rectangleMaterial);
    rectangle.position.set(extent[0][0] + width / 2, extent[0][1] + height / 2, -0.1); // Change z position to -0.1
    scene.add(rectangle);
  } else {
    for (const childNode of node.nodes) {
      placeCylindersAndOutlines(childNode);
    }
  }

  // Draw outline
  const extent = node.extent;
  const width = extent[1][0] - extent[0][0];
  const height = extent[1][1] - extent[0][1];
  const outline = createWireframeRectangle(width, height, 0x000000); // Change color to black
  outline.position.set(extent[0][0], extent[0][1], 0);
  scene.add(outline);
}


placeCylindersAndOutlines(quadtree._root);

// Set the camera position
camera.position.z = 100;

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
  if (node.userData && node.userData.cylinder) {
    node.userData.cylinder.rotation.y += yRotationSpeed;
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

  // Update rotation for all cylinders
  cylinders.forEach((cylinder, index) => {
    //cylinder.rotation.x += 0.1;
    cylinder.rotation.y += yRotationSpeed;

    // Update the revolution counter for the first cylinder
    if (index === 0) {
      revolutionCounter.rotationY += yRotationSpeed;
      if (revolutionCounter.rotationY >= 2 * Math.PI) {
        revolutionCounter.rotationY -= 2 * Math.PI;
        revolutionCounter.revolutions++;
      }
    }
  });

  // Update the revolution count display for the first cylinder
  revolutionCounterElement.innerHTML = ` ${revolutionCounter.revolutions} revolutions`;

  renderer.render(scene, camera);
}

animate();
