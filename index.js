let faceLandmarker;
let video;
let rotation;
const meshNodes = [
  "Wolf3D_Head",
  "Wolf3D_Teeth",
  "Wolf3D_Beard",
  "Wolf3D_Avatar",
  "Wolf3D_Head_Custom",
];
const avatarUrl = "./avatar.glb";
const scene = new THREE.Scene();
const camera = createCamera();
const textureLoader = new THREE.TextureLoader();
const renderer = createRenderer();
const light = new THREE.AmbientLight(0x404040, 10);
let modelGltfInstance;
let blendshapes;
let allModelNodes = {};
let headMesh = [];

let opVideo;

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.physicallyCorrectLights = true;
  renderer.gammaInput = true;
  renderer.gammaOutput = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.bias = 0.0001;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);
  return renderer;
}
function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    10,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  camera.position.z = 8;
  camera.position.y = 0;
  camera.position.x = 0;

  return camera;
}

const options = {
  baseOptions: {
    modelAssetPath: "./model.task",
    delegate: "GPU",
  },
  numFaces: 1,
  runningMode: "VIDEO",
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true,
};

function setMeshGeo() {
  if (headMesh.length > 0) {
    if (blendshapes.length > 0) {
      // TODO: handle face parts movements
      console.log(blendshapes);
      console.log(headMesh);
      blendshapes.forEach((element) => {
        headMesh.forEach((mesh) => {
          const index = mesh.morphTargetDictionary[element.categoryName];
          console.log(index);
          if (index >= 0) {
            mesh.morphTargetInfluences[index] = element.score;
          }
        });
      });
      // TODO: handle head and neck rotate
      if (allModelNodes.Head && allModelNodes.Neck && allModelNodes.Spine2) {
        allModelNodes.Head.rotation.set(rotation.x, rotation.y, rotation.z);
        allModelNodes.Neck.rotation.set(
          rotation.x / 5 + 0.3,
          rotation.y / 5,
          rotation.z / 5
        );
        allModelNodes.Spine2.rotation.set(
          rotation.x / 10,
          rotation.y / 10,
          rotation.z / 10
        );
      }
    }
  }
}
const predict = async () => {
  let nowInMs = Date.now();
  lastVideoTime = video.currentTime;
  const faceLandmarkerResult = await faceLandmarker.detectForVideo(
    video,
    nowInMs
  );

  // TODO: handle after model prediction
  if (
    faceLandmarkerResult.faceBlendshapes &&
    faceLandmarkerResult.faceBlendshapes.length > 0
  ) {
    blendshapes = faceLandmarkerResult.faceBlendshapes[0].categories;
    const matrix = new THREE.Matrix4().fromArray(
      faceLandmarkerResult.facialTransformationMatrixes[0].data
    );
    rotation = new THREE.Euler().setFromRotationMatrix(matrix);
    setMeshGeo();
  }
  window.requestAnimationFrame(predict);
};

async function main() {
  import("./vision_bundle.js").then(
    async ({ FilesetResolver, FaceLandmarker }) => {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );

      faceLandmarker = await FaceLandmarker.createFromOptions(
        filesetResolver,
        options
      );

      video = document.createElement("video");
      opVideo = document.createElement("video");
      // 640,360
      let videoHeight = 360;
      let videoWidth = 640;
      let videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: videoWidth },
          height: { ideal: videoHeight },
          frameRate: { ideal: 15, max: 30 },
        },
      });

      const canvas = document.createElement("canvas");
      const canvasCtx = canvas.getContext("2d");

      canvas.height = videoHeight;
      canvas.width = videoWidth;
      //   document.body.appendChild(canvas);
      video.autoplay = true;
      video.srcObject = videoStream;

      function drawVideo() {
        canvasCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
        requestAnimationFrame(drawVideo);
      }
      video.addEventListener("play", function () {
        drawVideo();
      });
      video.addEventListener("loadeddata", predict);
      const loader = new THREE.GLTFLoader();

      document.body.appendChild(renderer.domElement);
      scene.background = new THREE.Color(0x303f9f);

      scene.add(light);

      loader.load(
        "./avatar.glb",
        function (gltf) {
          gltf.scene.position.set(0, -1.75, 3);
          modelGltfInstance = gltf.scene;
          scene.add(modelGltfInstance);
          if (modelGltfInstance) {
            modelGltfInstance.traverse((modelNode) => {
              allModelNodes[modelNode.name] = modelNode;
              if (meshNodes.indexOf(modelNode.name) != -1)
                headMesh.push(modelNode);
            });
          }
        },
        undefined,
        function (error) {
          console.error(error);
        }
      );
      opVideo.width = 480;
      opVideo.height = 300;
      opVideo.autoplay = true;
      const canvasStream = renderer.domElement.captureStream();
      opVideo.srcObject = canvasStream;
      //   document.body.appendChild(opVideo);
      const render = function () {
        requestAnimationFrame(render);
        renderer.render(scene, camera);
      };

      render();
    }
  );
}
window.addEventListener("DOMContentLoaded", main);
