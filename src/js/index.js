// if(!gltfEnd && controlsFlag != 'pingmian') {
//     $('#container').append(`
//     <div id="loading">
//         <div class="load-test">校园地图正在玩命加载中。。。。请稍等</div>
//     </div>
//     `);
// }
import '../style/index';
import '../style/style';
import { GetQueryString, fuzzyQuery, CalculationX, CalculationZ, unid, erwei } from '../utils/util';
import loadGltf from '../utils/loadGltf';
import $ from 'jquery';
import arrJson from '../utils/test.json';
// alert(navigator.userAgent)
console.log(process.env.BASE_API)
if(navigator.userAgent.indexOf('iPhone') == -1) {
    //防止页面后退
    var XBack = {};
    
    (function(XBack) {
        XBack.STATE = 'x - back';
        XBack.element;

        XBack.onPopState = function(event) {
            event.state === XBack.STATE && XBack.fire();
            XBack.record(XBack.STATE); //初始化事件时，push一下
        };

        XBack.record = function(state) {
            history.pushState(state, null, location.href);
        };

        XBack.fire = function() {
            var event = document.createEvent('Events');
            event.initEvent(XBack.STATE, false, false);
            XBack.element.dispatchEvent(event);
        };

        XBack.listen = function(listener) {
            XBack.element.addEventListener(XBack.STATE, listener, false);
        };

        XBack.init = function() {
            XBack.element = document.createElement('span');
            window.addEventListener('popstate', XBack.onPopState);
            XBack.record(XBack.STATE);
        };

    })(XBack); // 引入这段js文件

    XBack.init();
    XBack.listen(function() {});
}
// 模型是否加载完毕
const gltfEnd = localStorage.getItem('gltfEnd');
// 默认为地三人称相机
let controlsFlag = GetQueryString('controlsFlag') ? GetQueryString('controlsFlag') : 'pingmian';
/* 地图路线绘制 */
const map = new AMap.Map("mapBox", {
    viewMode:'3D',
    zoom: 18,
    center: [116.64863,39.920623]
});
/* 必须有的值
    * scene 场景
    * camera 相机
    * renderer 渲染器 
    * controls 控制器
    * mesh 箭头相当于一个人的指示
    * meshEnd 终点坐标
    * curve路线的绘制
    * progress 漫游相机速度
    * startPathX 在x轴上的位置
    * startPathZ 在z轴上的位置
    * controlsFlag 相机切换
    * stepsList 路线点
    * clickX 点击终点的x坐标
    * clickZ 点击终点的y坐标
    * center 全景图位置
    * nearby 附近的坐标
    * startCenter 导航起点
    * endCenter 导航终点
    * position 校园风光位置
    * meshBg 地图底图
*/
let scene, camera, renderer, controls, mesh, meshEnd, curve, progress=0, startPathX, startPathZ, stepsList = [], clickX, clickZ;
const center = GetQueryString('center');
const nearby = GetQueryString('nearby');
const startCenter = GetQueryString('startCenter');
const endCenter = GetQueryString('endCenter');
const position = GetQueryString('position');
// 默认为地三人称相机
let controlsFlag = GetQueryString('controlsFlag') ? GetQueryString('controlsFlag') : 'pingmian';
// 是否缓存
// const storageDB = localStorage.getItem('storageDB')
/* 初始坐标在北门 */
startPathX = CalculationX(116.648592);
startPathZ = CalculationZ(39.921754);
// 性能插件
// let stats = initStats();
/* 创建场景 */
function initScene() {
    scene = new THREE.Scene();
}

/* 性能插件 */
function initStats() {

    let stats = new Stats();

    // document.body.appendChild(stats.domElement);

    return stats;

}

/* 数据更新 */
function update() {

    stats.update();

}
/* 相机 */
function initCamera() {
    /*
    * 视野
    * 宽高比
    * 近端渲染
    * 远端剪切平面可以看到多远
    */
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
    if(controlsFlag == 'pingmian') {
        // alert(1)
        // 默认相机坐标
        camera.position.set(0, 45, 0)
    }else if(controlsFlag == 'renwu') {
        // 修改相机坐标
        camera.position.set(startPathX, .18, startPathZ);
        geolocation();
        setInterval(function() {
            geolocation(); 
        },5000)
    }else if(controlsFlag == 'manyou') {
        const manyouPathX = CalculationX(116.64861023);
        const manyouPathZ = CalculationZ(39.92165992);
        camera.position.set(manyouPathX, .18, manyouPathZ);
    }else if(controlsFlag == '3d') {
        camera.position.set(30, 0, 30)
    }
}

/* 渲染器 */
function initRender() {
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff);
    document.getElementById('three').appendChild(renderer.domElement);
    
}

/* 灯光 */
function initLight() {
  let light = 1.2;
//   if (storageDB) {
//     light = 0.6;
//   }
  // 半球光就是渐变的光；
  // 第一个参数是天空的颜色，第二个参数是地上的颜色，第三个参数是光源的强度
  var hemisphereLight = new THREE.HemisphereLight(0xaaaaaa,0xffffff, light);

   // 方向光是从一个特定的方向的照射
   // 类似太阳，即所有光源是平行的
   // 第一个参数是关系颜色，第二个参数是光源强度
  var shadowLight = new THREE.DirectionalLight(0xffffff, light);

    // 设置光源的方向。  
   // 位置不同，方向光作用于物体的面也不同，看到的颜色也不同
   shadowLight.position.set(100, 100, 100);

    // 为了使这些光源呈现效果，只需要将它们添加到场景中
    var ambientLight = new THREE.AmbientLight(0xffffff, light);
    var spotLight = new  THREE.SpotLight(0xFFFFFF);
    spotLight.position.set(100, 100, 100);
    scene.add(spotLight);
    scene.add(ambientLight);
    scene.add(hemisphereLight);  
    scene.add(shadowLight);
}

/* 
* 控制器
* 控制相机使用模式
* OrbitControlsTwo修改的第三人称相机源码加了范围和手势拖动
* FirstPersonControls 修改相机为第一人称漫游和人物视角可以用
*/
function initControls() {
    if(controlsFlag == 'pingmian') {
        controls = new THREE.OrbitControlsTwo(camera, renderer.domElement);
        // 控制拖动角度
        // controls.maxAzimuthAngle = 1.4;
        // controls.minAzimuthAngle = .5;
    }else if(controlsFlag == '3d') {
        // alert(1)
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        // 控制3D视角角度
        controls.maxPolarAngle = 1.4;
        controls.minPolarAngle = 0.5;
    }else if(controlsFlag == 'renwu' || controlsFlag == 'manyou') {
        // 第一人称相机控制器
        controls = new THREE.FirstPersonControls(camera, renderer.domElement);
        controls.actualLookSpeed = 300; //相机移动速度
        controls.noFly = true;
        controls.constrainVertical = true; //约束垂直
        // 控制第一人称上下视角角度
        controls.verticalMin = 1.0;
        controls.verticalMax = 2.0;
        controls.lat = 0; //初始视角进入后y轴的角度
        controls.lon = 90;
    }
}
// 模型加载个数初始值
let gltfNum = 0;
/* 场景中的内容加载gltf格式也可以换成其他格式*/
function initContent() {
    console.log('模型个数',loadGltf.length)
    const gltfLength = loadGltf.length;
    // 加载 glTF 格式的模型
    let loader; /*实例化加载器*/
    // 分批加载资源
    loadGltf.forEach((item, index) => {
        //  Files
        loader = new THREE.GLTFLoader();
        loader.load(`${process.env.BASE_API}3dschool/School/${item.name}/${item.name}.gltf`, function (obj) {              
            /*简便加载gltf模型*/
            var object = obj.scene
            // 修改位置坐标
            object.position.y = 0;
            object.position.x = 0;
            object.position.z = 0;
            if(controlsFlag == '3d' || controlsFlag == 'manyou' || controlsFlag == 'renwu') {
                scene.add(object);
            }else {
                gltfNum++
                if(gltfNum == gltfLength) {
                    // $('#loading').hide();
                    localStorage.setItem('gltfEnd', true); 
                }
                console.log('mocing',gltfNum)
            }
    
        }, function (xhr) {

            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    
        }, function (error) {
            console.log('load error!' + error.getWebGLErrorMessage());
    
        })
    })

}

/* 地图底图 加载底图图片 PlaneGeometry二维平面*/
function initBg() {
    var skyBoxGeometry1 = new THREE.PlaneGeometry(78, 39, 1); 
    for(let i = 1, n = 5; i <= n; i++) {
        // ${process.env.BASE_API}
        if(controlsFlag == '3d' || controlsFlag == 'manyou' || controlsFlag == 'renwu') {
            var texture = new THREE.TextureLoader().load(`${process.env.BASE_API}/3dschool/schoolatlas/0${i}a.png`);
        }else {
            var texture = new THREE.TextureLoader().load(`${process.env.BASE_API}/3dschool/schoolatlas/0${i}.png`);
        }
        var material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });
        const meshBg = new THREE.Mesh(skyBoxGeometry1, material);
        meshBg.position.y = 0;
        meshBg.position.x = 0;
        meshBg.position.z = 0;
        meshBg.rotation.x += -0.5 * Math.PI;
        scene.add(meshBg);
    }
    var skyBoxGeometry2 = new THREE.PlaneGeometry(164, 164, 1); 
    for(let i = 1, n = 4; i <= n; i++) {
        // ${process.env.BASE_API}
        var texture = new THREE.TextureLoader().load(`${process.env.BASE_API}3dschool/schoolatlas/m0${i}.png`);
        var material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });
        var meshBg = new THREE.Mesh(skyBoxGeometry2, material);
        meshBg.position.y = -.4;
        meshBg.position.x = .3;
        meshBg.position.z = 2;
        meshBg.rotation.x += -0.5 * Math.PI;
        scene.add(meshBg);
    }    
}

/* 加载天空盒子 */
function makeSkybox() {
    // scene.background = new THREE.CubeTextureLoader()
    // .setPath("https://ryxy-china.picp.vip:8081/skybox/")
    // .load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png', ]);
    //这部分是给出图片的位置及图片名
    var directions  = ["px", "nx", "py", "ny", "pz", "nz"];//获取对象
    //创建一个立方体并且设置大小
    var skyGeometry = new THREE.CubeGeometry( 160, 160, 160 );
    //这里是用于天空盒六个面储存多个材质的数组
    var materialArray = [];
    //循环将图片加载出来变成纹理之后将这个物体加入数组中
    for (var i = 0; i < 6; i++)
        materialArray.push( new THREE.MeshBasicMaterial({
            //这里imagePrefix + directions[i] + imageSuffix 就是将图片路径弄出来
            // ${process.env.BASE_API}
            map: new THREE.TextureLoader().load(`${process.env.BASE_API}3dschool/skybox/${directions[i]}.png`),
            side: THREE.BackSide  //因为这里我们的场景是在天空盒的里面，所以这里设置为背面应用该材质
        }));

    //MultiMaterial可以将MeshBasicMaterial多个加载然后直接通过Mesh生成物体
    var skyMaterial = new THREE.MultiMaterial( materialArray );
    //加入形状skyGeometry和材质MultiMaterial
    var sky = new THREE.Mesh( skyGeometry, skyMaterial );
    //设置天空盒的高度
    sky.position.y = 0;
    //场景当中加入天空盒
    scene.add( sky );
}

/** 
 * 设置漫游路线 设置地点移动相机
 * 不设置点的话全局漫游
*/
function manyouPath(startLon, startLat, endLon,endLat) {
    curve = new THREE.CatmullRomCurve3();
    /**
     * 大门 ——》学生公寓五号楼——》学生中心-》北门
     * 大门坐标 116.64861023,39.92165992
     * 学生公寓五号楼 116.64761,39.919361
     * 学生中心 116.649418,39.919676
     */
    const maps = new Graph(arrJson);
    let pathArr = [];
    if (!startLon) {
        // 大门 ——》学生公寓五号楼
        var startX= Math.round(CalculationX(116.64861023) * 2.5 + 100);
        var startY= Math.round(CalculationZ(39.92165992) * 2.5 + 100);
        var endX= Math.round(CalculationX(116.646457) * 2.5 + 100);
        var endY= Math.round(CalculationZ(39.919402) * 2.5 + 100);
        var start = maps.grid[startX][startY];
        var end = maps.grid[endX][endY];
        const result = astar.search(maps, start, end);
        result.forEach(items => {
            let arr = [];
            // console.log((items.x-100)/ 2.5);
            // console.log((items.y-100)/ 2.5);
            arr[0] = (items.x-100) * 0.4;
            arr[1] = (items.y-100) * 0.4;
            pathArr.push(arr)
        }) 
        // 学生中心——》北门
        var startX1= Math.round(CalculationX(116.649418) * 2.5 + 100);
        var startY1= Math.round(CalculationZ(39.919676) * 2.5 + 100);
        var endX1= Math.round(CalculationX(116.64861023) * 2.5 + 100);
        var endY1= Math.round(CalculationZ(39.92165992) * 2.5 + 100);
        var start1 = maps.grid[startX1][startY1];
        var end1 = maps.grid[endX1][endY1];
        const result1 = astar.search(maps, start1, end1);
        result1.forEach(items => {
            let arr = [];
            // console.log((items.x-100)/ 2.5);
            // console.log((items.y-100)/ 2.5);
            arr[0] = (items.x-100) * 0.4;
            arr[1] = (items.y-100) * 0.4;
            pathArr.push(arr)
        }) 
    }else {
        var startX= Math.round(CalculationX(startLon) * 2.5 + 100);
        var startY= Math.round(CalculationZ(startLat) * 2.5 + 100);
        var endX= Math.round(CalculationX(endLon) * 2.5 + 100);
        var endY= Math.round(CalculationZ(endLat) * 2.5 + 100);
        var start = maps.grid[startX][startY];
        var end = maps.grid[endX][endY];
        const result = astar.search(maps, start, end);
        result.forEach(items => {
            let arr = [];
            // console.log((items.x-100)/ 2.5);
            // console.log((items.y-100)/ 2.5);
            arr[0] = (items.x-100) * 0.4;
            arr[1] = (items.y-100) * 0.4;
            pathArr.push(arr)
        }) 
    }
    pathArr.forEach(item => {
        // 给空白几何体添加点信息，这里写3个点，geometry会把这些点自动组合成线，面。
        curve.points.push(new THREE.Vector3(item[0], .2, item[1]));
    })

    /* 看相机走的路径 */
    // var tubeGeometry = new THREE.TubeGeometry(curve, 0, 0, 0, false);
    // var tube = new THREE.Mesh(tubeGeometry);
    // scene.add(tube)

    /** 
     * 高德地图导航暂时注释会在物体下有点问题采用A*寻路必须先设置路线
    */ 
    /*
    //步行导航
    var walking = new AMap.Walking({
        map: map
    }); 
    //根据起终点坐标规划步行路线
    walking.search([startLon, startLat], [endLon, endLat], function(status, result) {
        // result即是对应的步行路线数据信息，相关数据结构文档请参考  https://lbs.amap.com/api/javascript-api/reference/route-search#m_WalkingResult
        if (status === 'complete') {
            const steps = result.routes[0].steps;
            steps.forEach((item) => {
                let arr = [];
                if(item.path) {
                    item.path.forEach((items) => {
                        const x = CalculationX(items.lng);
                        const z = CalculationZ(items.lat);
                        arr.push([x, z])
                    })
                }
                stepsList.push(arr)
            });
            const uuidArr = unid(stepsList);
            const erweiArr = erwei(uuidArr); 
            erweiArr.forEach(item => {
                curve.points.push(new THREE.Vector3(item[0], 0, item[1]))
            })
            curve.points.push(new THREE.Vector3(CalculationX(endLon), 0, CalculationZ(endLat)))
            // 相机管道，更方便直观的看相机走的路线
            // var tubeGeometry = new THREE.TubeGeometry(curve, 0, 0, 0, false);
            // var textureLoader = new THREE.TextureLoader();
            // var texture = textureLoader.load('https://ryxy-china.picp.vip:8081/01.png');
            // texture.wrapS = THREE.RepeatWrapping
            // texture.wrapT=THREE.RepeatWrapping
            // // 设置x方向的偏移(沿着管道路径方向)，y方向默认1
            // //等价texture.repeat= new THREE.Vector2(20,1)
            // texture.repeat.x = 20;
            // var tubeMaterial = new THREE.MeshPhongMaterial({
            //     map: texture,
            //     transparent: true,
            // });
            // var tube = new THREE.Mesh(tubeGeometry);
            // scene.add(tube) 
        } else {
            console.log('失败')
        } 
    });
    */
}

/** 
 * 生成网格
 * 可以更直观的看a*寻路，默认生成的网格都是为可以看到可不可以走
*/

var length = 2000;
function initGround() {
	var geometry = new THREE.Geometry();
	geometry.vertices.push(new THREE.Vector3(-length / 50, 0, 0));
	geometry.vertices.push(new THREE.Vector3(length / 50, 0, 0));			
	for(var i = 0; i <= length / 10; i++) {
		var line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
			color: 0x808080,
			opacity: 1
		}));
		line.position.z = (i * 10 / 25) - length / 50;
        scene.add(line);

		var line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
			color: 0x808080,
			opacity: 1
		}));
		line.position.x = (i * 10 / 25) - length / 50;
		line.rotation.y = 90 * Math.PI / 180;
        scene.add(line);

	}
	var skyBoxGeometry = new THREE.CubeGeometry(10000, 10000, 10000);
	var skyBoxMaterial = new THREE.MeshBasicMaterial({
		color: 0xFFFFFF,
		side: THREE.BackSide
	});
	var skyBox = new THREE.Mesh(skyBoxGeometry, skyBoxMaterial);
    scene.add(skyBox);

}

/** 
 * 网格的生成是不是可以走
*/

let clickX1, clickZ1;
var graph = [];
function initGrid() {
    var geometry = new THREE.CubeGeometry( .25,.25,.25);
    var material = new THREE.MeshBasicMaterial( {color: 0x000cfd} );
    for(var i=0;i<length/10;i++){
        var nodeRow = [];
        graph.push(nodeRow);
        for(var j=0;j<length/10;j++){
            nodeRow.push(0);
            if(arrJson[i][j] == 0) {
                var cube = new THREE.Mesh( geometry, material );
                cube.position.set((i-100)*.4,0,(j-100)*.4);
                scene.add(cube);
            }
        }
    }
}


/* 设置导航路线 */
function axes(startLon, startLat, endLon,endLat, fn) {
    //定义材质THREE.LineBasicMaterial . MeshBasicMaterial...都可以
    var material = new THREE.LineBasicMaterial({color:0xff6804, linewidth: 5});
    // 空几何体，里面没有点的信息,不想BoxGeometry已经有一系列点，组成方形了。
    var geometry = new THREE.Geometry();
    var maps = new Graph(arrJson);

    var startX= Math.round(startLon * 2.5 + 100);
    var startY= Math.round(startLat * 2.5 + 100);
    var endX= Math.round(CalculationX(endLon) * 2.5 + 100);
    var endY= Math.round(CalculationZ(endLat) * 2.5 + 100);
    var start = maps.grid[startX][startY];
    var end = maps.grid[endX][endY];

    /**
     * 导航起点是否显示
     */
    /*
    var geometry2 = new THREE.BoxGeometry(.25, .25, .25);
    var material2 = new THREE.MeshBasicMaterial( {color: 0xfff000} );					
    var cube2 = new THREE.Mesh( geometry2, material2 );
    cube2.position.set(CalculationX(startLon),0,CalculationZ(startLat));
    scene.add(cube2);

    var geometry1 = new THREE.BoxGeometry(.25, .25, .25);
    var material1 = new THREE.MeshBasicMaterial( {color: 0xff0000} );					
    var cube1 = new THREE.Mesh( geometry1, material1 );
    cube1.position.set(CalculationX(endLon),0,CalculationZ(endLat));
    scene.add(cube1);
    */
    const result = astar.search(maps, start, end);
    let pathArr = [];
    result.forEach(items => {
        let arr = [];
        // console.log((items.x-100)/ 2.5);
        // console.log((items.y-100)/ 2.5);
        arr[0] = (items.x-100) * 0.4;
        arr[1] = (items.y-100) * 0.4;
        pathArr.push(arr)
    }) 
    if(result.length==0){
        alert("无可到达路径");
        // cleanSphere(); 
        return;
    }
    pathArr.forEach(item => {
        // 给空白几何体添加点信息，这里写3个点，geometry会把这些点自动组合成线，面。
        geometry.vertices.push(new THREE.Vector3(item[0], .2, item[1]));
    })
    //线构造
    var line=new THREE.Line(geometry,material);
    // 加入到场景中
    scene.add(line); 
    if (fn) {
        fn(pathArr.length * 4)
        // //步行导航
        // var walking = new AMap.Walking({
        //     map: map
        // }); 
        // //根据起终点坐标规划步行路线
        // walking.search([startLon, startLat], [endLon, endLat], function(status, result) {
        //     // result即是对应的步行路线数据信息，相关数据结构文档请参考  https://lbs.amap.com/api/javascript-api/reference/route-search#m_WalkingResult
        //     if (status === 'complete') {
        //         fn(result)
        //     } else {
        //         console.log('失败')
        //         // log.error('步行路线数据查询失败' + result)
        //     } 
        // });
    }

}

/* 窗口变动触发 */
function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
/* 加载导航箭头图片 */
function loadImg() {
    /* 中心点坐标轴辅助线 */
    /*
    
    var axes = new THREE.AxisHelper(10);
    scene.add(axes);

    */
    // 需要改为定位获取
    const x = startPathX;
    const z = startPathZ;
    console.log(x, z)
    var skyBoxGeometry = new THREE.PlaneGeometry(1.5, 1.5); 
    var texture = new THREE.TextureLoader().load(require(`../static/img/ren.png`));
    var material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
    });
    mesh = new THREE.Mesh(skyBoxGeometry, material);
    mesh.position.y = 0.2;
    mesh.position.x = x;
    mesh.position.z = z;
    mesh.rotation.x += -0.5 * Math.PI;
    mesh.rotation.z += -1 * Math.PI;
    scene.add(mesh);
    geolocation();
    setInterval(function() {
        geolocation();
    }, 5000)
}

/*加载起点图标*/
function loadStartImg(x, z) {
    // 需要改为定位获取
    clickX = x;
    clickZ = z;
    var skyBoxGeometry = new THREE.CubeGeometry(); 
    var texture = new THREE.TextureLoader().load(require(`../static/img/Start.png`));
    var material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
    });
    const meshStart = new THREE.Mesh(skyBoxGeometry, material);
    if(controlsFlag == 'pingmian') {
        meshStart.position.y = 2.5;
    } else {
        meshStart.position.y = 1;
    }
    meshStart.position.x = clickX;
    meshStart.position.z = clickZ;
    scene.add(meshStart);
}

/*加载终点图标*/
function loadEndImg(x, z, fn) {
    // 需要改为定位获取
    clickX = CalculationX(x);
    clickZ = CalculationZ(z);
    var skyBoxGeometry = new THREE.CubeGeometry(); 
    var texture = new THREE.TextureLoader().load(require(`../static/img/End1.png`));
    var material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
    });
    meshEnd = new THREE.Mesh(skyBoxGeometry, material);
    if(controlsFlag == 'pingmian') {
        meshEnd.position.y = 8;
    } else {
        meshEnd.position.y = 1;
    }
    
    meshEnd.position.x = clickX;
    meshEnd.position.z = clickZ;
    scene.add(meshEnd);
    document.addEventListener( 'click', onMouseClick.bind(window, fn), false );
}
/**
 * 把点击事件放到最外边获取点击的坐标
 */
// window.addEventListener( 'click', onMouseClick.bind(window, function() {}), false );

/**封装点击事件 */
/**
 * x 坐标x位置
 * z 坐标z位置
 * fn 点击执行的回调
 * event 点击事件参数
 * clickX2 绘制路线对比参数
 * clickZ2 绘制路线对比参数
 */
let clickX2 = 0;
let clickZ2 = 0;
function onMouseClick(fn, event ) {
    //声明raycaster和mouse变量
    var raycaster= new THREE.Raycaster();
    let mouse = new THREE.Vector2();
    //通过鼠标点击的位置计算出raycaster所需要的点的位置，以屏幕中心为原点，值的范围为-1到1.
    mouse.x = (event.clientX/window.innerWidth)*2 -1;
    mouse.y = -(event.clientY/window.innerHeight)*2 + 1;

    /* 点击绘制路线代码 暂时注释 */
    /*
    var fxl=new THREE.Vector3(0, .1, 0); 
    var groundplane=new THREE.Plane(fxl,0);
    //从相机发射一条射线，经过鼠标点击位置
    raycaster.setFromCamera(mouse,camera);
    //计算射线相机到的对象，可能有多个对象，因此返回的是一个数组，按离相机远近排列
    var ray=raycaster.ray;
    let intersects = ray.intersectPlane(groundplane);
    console.log(intersects.x + ' ' + intersects.z)
    */
    /**
     * 点击绘制路线代码先注释 可以配置路线可不可以走
     */
    /*
    clickX1 = intersects.x;
    clickZ1 = intersects.z;
    if((clickX2 != clickX1) && (clickZ2 != clickZ1)) {
        var geometry = new THREE.BoxGeometry(.25, .25, .25);
        var material = new THREE.MeshBasicMaterial( {color: 0x000cfd} );					
        var cube = new THREE.Mesh( geometry, material );
        cube.position.set(Math.round(clickX1/0.4)*0.4,0,Math.round(clickZ1/0.4)*0.4);
        console.log(Math.round(clickX1*2.5 + 100),Math.round(clickZ1*2.5 + 100))
        const a = Math.round(clickX1*2.5 + 100);
        const b = Math.round(clickZ1*2.5 + 100);
        scene.add(cube);
        graph[a][b] = 1;
        clickX2 = clickX1;
        clickZ2 = clickZ1;
    } else {
        var geometry = new THREE.BoxGeometry(.25, .25, .25);
        var material = new THREE.MeshBasicMaterial( {color: 0xff0000} );					
        var cube = new THREE.Mesh( geometry, material );
        cube.position.set(Math.round(clickX1/0.4)*0.4,0,Math.round(clickZ1/0.4)*0.4);
        console.log(Math.round(clickX1*2.5 + 100),Math.round(clickZ1*2.5 + 100))
        const a = Math.round(clickX1*2.5 + 100);
        const b = Math.round(clickZ1*2.5 + 100);
        scene.add(cube);
        graph[a][b] = 0;
    }
    */
  
    // 通过鼠标点的位置和当前相机的矩阵计算出raycaster
    raycaster.setFromCamera( mouse, camera );

    // 获取raycaster直线和所有模型相交的数组集合
    var intersects = raycaster.intersectObjects( scene.children );
    
    console.log(JSON.parse(JSON.stringify(meshEnd)).object, intersects[0])
    const clickUuid = intersects[0].object.uuid;
    const meshEndUuid = JSON.parse(JSON.stringify(meshEnd)).object.uuid;
    // console.log(clickUuid ==  meshEndUuid)
    // 判断点击物体uuid是否相等就可以知道是否点击了这个物体
    if(clickUuid ==  meshEndUuid) {
        fn();
    }
}

/*导出行走的路线 */
function fakeClick(obj) { 
　　var ev = document.createEvent("MouseEvents");
　　　　ev.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
　　　　obj.dispatchEvent(ev);
}

function exportRaw(name, data) {
　　　　var urlObject = window.URL || window.webkitURL || window;
　　　　var export_blob = new Blob([data]);
　　　　var save_link = document.createElementNS("http://www.w3.org/1999/xhtml", "a")
　　　　save_link.href = urlObject.createObjectURL(export_blob);
　　　　save_link.download = name;
　　　　fakeClick(save_link);
}
/**
 * 网格绘制辅助A*寻路查看路线可不可以走
 */
function pathGrid () {
    initGround();
    initGrid(); 
}

/* 初始化 */
function init() {
    
    initScene();
    initRender();
    initCamera();
    initLight();
    initControls();
    //以centerLng所在点tile中心点为中心，加载tile
    // loadMap(tilePos.tileinfo.x, tilePos.tileinfo.y);
    if(controlsFlag == 'pingmian' || controlsFlag == '3d') {
        loadImg();
    }
    initBg();
    if(controlsFlag == '3d' || controlsFlag == 'manyou' || controlsFlag == 'renwu') {
        makeSkybox();
    }

    if(gltfEnd) {
        initContent();
    }else {
        setTimeout(function() {
            initContent();
        },10000)
    }
    
    /* grid绘制网格 */
    // pathGrid()

    if(controlsFlag == 'manyou') {
        manyouPath()
    }
    
    /* 监听事件 */
    window.addEventListener('resize', onWindowResize, false);

}

var clock = new THREE.Clock();
var renderEnabled;

/* 循环渲染 */
function animate() {
    // requestAnimationFrame(animate);
    controls.update(clock.getDelta());
    if(controlsFlag == 'manyou') {
        // if(progress>1.0){
        //     return;    //停留在管道末端,否则会一直跑到起点 循环再跑
        // }
        // 相机漫游模式
        if (curve.points.length > 0) {
            progress += 0.0001;
            let point = curve.getPointAt(progress);
            if ( point && point.x ) {
                camera.position.set(point.x, .18, point.z)
                // mesh.position.set(point.x,poin2t.y,point.z);
            }
        }
    }

    renderer.render(scene, camera);

    requestAnimationFrame(animate);
    // renderer.render(scene, camera);
    // update();
}


/* 初始加载 */
(function () {
    console.log("three init start...");

    init();
    animate();

    console.log("three init send...");
})();

/*模糊查询列表 */
let mapList = [];
// 获取模糊查询信息
$.ajax({ 
    // ${process.env.BASE_API}
    url: `${process.env.BASE_API}school-map/sitePosition/getAll`, 
    success: function(res){
        console.log('模糊查询',res)
        if(res.code == 200) {
            mapList = res.data;
            /* 绘制路可以走的路线终点 */
            /*
            mapList.forEach(function(items) {
                const position =  items.center.split(',');
                const clickX3 = CalculationX(position[0]);
                const clickZ3 = CalculationZ(position[1]);
                var geometry = new THREE.BoxGeometry(.25, .25, .25);
                var material = new THREE.MeshBasicMaterial( {color: 0xfffd7f} );					
                var cube = new THREE.Mesh( geometry, material );
                console.log(clickX3, clickZ3)
                cube.position.set(Math.round(clickX3/0.4)*0.4,0,Math.round(clickZ3/0.4)*0.4);
                scene.add(cube);
            })
            */

        }
    }
});

/* 以下是地图逻辑 */

/* 全景图展示 */
if (center) {
    // 获取全景展示信息
    // https://ryxy-china.picp.vip/school-map/quanjing/getAll
    $('.head').show().find('span').html('退出全景');
    $('.serach').hide();
    $('.menu').hide();
    $('.footer').hide();
    $.ajax({ 
        // ${process.env.BASE_API}
        url: `${process.env.BASE_API}school-map/quanjing/getAll`, 
        success: function(res){
            console.log('全景图',res)
            if(res.code == 200) {
               const provinces = res.data;
               for (let i = 0; i < provinces.length; i += 1) {
                   // var markerContent = document.createElement("div");
                   if(provinces[i].center == center) {
                        const position =provinces[i].center.split(',');
                       // console.log(3333, provinces[i].center.split(','))
                        loadEndImg(position[0], position[1], function() {
                            window.location.href = './panorama.html?imgurl=' + provinces[i].imgUrl
                        });
                   }
               }
            }
        }
    });
}
$('input').on('input', function(e){
    const str = $('input').val();
    if(!str) {
        $('.search-list').hide().html('')
        return
    };
    $('.search-list').show().html('');
    let searchList = fuzzyQuery(mapList, str);
    if(searchList.length > 0) {
        searchList.forEach(function(item){
            $('.search-list').append(`<li class="search-position" data-position="${item.center}">${item.name}</li>`)
        })
        // 搜索位置并导航
        $('.search-position').click(function() {
            $('.search-list').hide();
            $('.footer').hide();
            $('.school').hide();
            $('.panorama').hide();
            const name = $(this).html();
            const position = $(this).attr('data-position').split(',');
            /**
             * 在此搜索删除上一个scene也就是删除上个终点
             */
            var allChildren = scene.children;
            var lastObject = allChildren[allChildren.length-1];
            if(lastObject instanceof THREE.Mesh){
                scene.remove(lastObject);
            }
            /**
             * 执行加载终点坐标方法绘制点并且导航
             */
            loadStartImg(startPathX, startPathZ);
            loadEndImg(position[0], position[1], function() {
                $('.serach').hide();
                axes(startPathX, startPathZ, position[0], position[1], function(result) {
                    $('.distance').show();
                    $('.head').show().find('span').html('退出导航');
                    $('.title').html('');
                    $('.title').append(`
                    <span>${name}</span>
                    <span>${result}.${Math.ceil(Math.random()*10)}米</span>`)
                })
            });
        })
    }else {
        $('.search-list').append('<li>没有查到</li>')
    }
    // 模糊查询关闭
    $('#three').click(function() {
        $('.search-list').hide()
    })
})
// 搜索模糊查询
$('.search-btn').click(function() {
    // exportRaw('test.json', JSON.stringify(graph))
    const str = $('input').val();
    if(!str) {
        $('.search-list').hide().html('')
        return
    };
    $('.search-list').show().html('');
    let searchList = fuzzyQuery(mapList, str);
    if(searchList.length > 0) {
        searchList.forEach(function(item){
            $('.search-list').append(`<li class="search-position" data-position="${item.center}">${item.name}</li>`)
        })
        // 搜索位置并导航
        $('.search-position').click(function() {
            $('.search-list').hide();
            $('.footer').hide();
            $('.school').hide();
            $('.panorama').hide();
            const name = $(this).html();
            const position = $(this).attr('data-position').split(',');
            /**
             * 在此搜索删除上一个scene也就是删除上个终点
             */
            var allChildren = scene.children;
            var lastObject = allChildren[allChildren.length-1];
            if(lastObject instanceof THREE.Mesh){
                scene.remove(lastObject);
            }
            /**
             * 执行加载终点坐标方法绘制点并且导航
             */
            loadStartImg(startPathX, startPathZ);
            loadEndImg(position[0], position[1], function() {
                $('.serach').hide();
                axes(startPathX, startPathZ, position[0], position[1], function(result) {
                    $('.distance').show();
                    $('.head').show().find('span').html('退出导航');
                    $('.title').html('');
                    $('.title').append(`
                    <span>${name}</span>
                    <span>${result}.${Math.ceil(Math.random()*10)}米</span>`)
                })
            });
        })
    }else {
        $('.search-list').append('<li>没有查到</li>')
    }
    // 模糊查询关闭
    $('#three').click(function() {
        $('.search-list').hide()
    })
})


// 附近跳转
if (nearby) {
    $('.head').show().find('span').html('发现周边');
    $('.return').attr('href', './periphery.html');
    $('.school').hide();
    $('.panorama').hide();
    $('.serach').hide();
    /* 异步方法 */
    function runAsync(){
        return new Promise(function(resolve, reject){
            // 获取周边详细信息
            $.ajax({ 
                // ${process.env.BASE_API}
                url: `${process.env.BASE_API}school-map/circum/getByTypeId?typeId=${nearby}`, 
                success: function(res){
                    console.log('周边详细信息',res)
                    if(res.code == 200) {
                        const zhoubian = res.data;
                        resolve(zhoubian);
                    }
                }
            });
        });        
    }
    runAsync().then(function(zhoubian) {
        zhoubian.forEach(item => {
            $('.nearby').append(
                `
                <div class="nearby-con">
                    <div class="nearby-details" data-position="${item.content}">
                        <img src="${item.imgUrl}" alt="">
                        <div class="left">
                            <span class="left-title">${item.name}</span>
                            <span>
                                ${item.description}
                            </span>
                        </div>
                    </div>
                </div>
                `
            )
        })
    }).then( function() {
        $('.nearby-details').click(function () {
            $('.nearby').hide();
            $('.footer').hide();
            const name = $(this).find('.left-title').html();
            const position = $(this).attr('data-position').split(',');
            /**
             * 显示终点坐标
             */
            loadEndImg(position[0], position[1], function() {
                axes(startPathX, startPathZ, position[0], position[1])
            });
        })
    })
    $('.nearby').show();
}

if (position) {
    $('.serach').hide();
    $('.menu').hide();
    $('.footer').hide();
    $('.head').show().find('span').html('主页面');
    const positions = position.split(',');
    /**
     * 显示终点坐标
     */
    loadEndImg(positions[0], positions[1], function() {
        $('.serach').hide();
        axes(startPathX, startPathZ, positions[0], positions[1])
    });
}

// 路线导航 
if(startCenter && endCenter) {
    $('.serach').hide();
    $('.menu').hide();
    $('.footer').hide();
    $('.head').show().find('span').html('主页面');
    const startCenterArr = startCenter.split(',');
    const endCenterArr = endCenter.split(',');
    // 加载终点和起点坐标 并且画线
    loadStartImg(CalculationX(startCenterArr[0]), CalculationZ(startCenterArr[1]))
    loadEndImg(endCenterArr[0], endCenterArr[1])
    axes(CalculationX(startCenterArr[0]),CalculationZ(startCenterArr[1]), endCenterArr[0], endCenterArr[1])
}
// 地图定位
function geolocation () {
    map.plugin('AMap.Geolocation', function () {
        var geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,//是否使用高精度定位，默认:true
            timeout: 100000,          //超过10秒后停止定位，默认：无穷大
            maximumAge: 0,           //定位结果缓存0毫秒，默认：0
            convert: true,           //自动偏移坐标，偏移后的坐标为高德坐标，默认：true
            showButton: true,        //显示定位按钮，默认：true
            buttonPosition: 'LB',    //定位按钮停靠位置，默认：'LB'，左下角
            buttonOffset: new AMap.Pixel(10, 20),//定位按钮与设置的停靠位置的偏移量，默认：Pixel(10, 20)
            showMarker: true,        //定位成功后在定位到的位置显示点标记，默认：true
            showCircle: true,        //定位成功后用圆圈表示定位精度范围，默认：true
            panToLocation: true,     //定位成功后将定位到的位置作为地图中心点，默认：true
            zoomToAccuracy:true      //定位成功后调整地图视野范围使定位位置及精度范围视野内可见，默认：false
        });
        map.addControl(geolocation);
        geolocation.getCurrentPosition();
        AMap.event.addListener(geolocation, 'complete', onComplete);//返回定位信息
        AMap.event.addListener(geolocation, 'error', onError);      //返回定位出错信息
    });
}
function onComplete(data) {
    if(data.position) {
        const initPosition = JSON.parse(JSON.stringify(data.position));
        startPathX = 116.643804 < initPosition.lng && initPosition.lng <116.650751 ? CalculationX(initPosition.lng) : CalculationX(116.648592);
        startPathZ = 39.921923 < initPosition.lat && initPosition.lat < 39.919047 ? CalculationZ(initPosition.lat) : CalculationZ(39.921754);
        /*
        var str = [];
        str.push('定位结果：' + data.position);
        str.push('定位类别：' + data.location_type);
        if(data.accuracy){
             str.push('精度：' + data.accuracy + ' 米');
        }//如为IP精确定位结果则没有精度信息
        str.push('是否经过偏移：' + (data.isConverted ? '是' : '否'));
        document.getElementById('weizhi').innerHTML =  str.join('<br>') + '您的位置：'+startPathX+',<br/>'+startPathZ +'<br/>' +CalculationX(startPathX)+'<br/>' +CalculationZ(startPathZ);
        */
        if(controlsFlag == 'pingmian' || controlsFlag == '3d') {
            mesh.position.x = startPathX;
            mesh.position.z = startPathZ;
        }
        if(controlsFlag == 'renwu') {
            console.log('=============',startPathX, startPathZ)
            camera.position.set(startPathX, .18, startPathZ)
        } 
        $(".amap-geolocation-con").remove()
    }
}
//解析定位错误信息
function onError(data) {
    // alert(JSON.stringify(data))
    if(controlsFlag == 'pingmian' || controlsFlag == '3d') {
        // 116.648653,39.921664 116.648592, 39.921754
        mesh.position.x = CalculationX(116.648592);
        mesh.position.z = CalculationZ(39.921754);
    }
    if(controlsFlag == 'renwu') {
        camera.position.set(CalculationX(116.648592), .18, CalculationZ(39.921754))
    } 
    $(".amap-geolocation-con").remove()
    // console.log(data)
}
$(".service").click(function(){
    $(".service-container").show();
    $(".container").show();
    map.clearMap();
});
$(".service-container").click(function() {
    $(this).hide();
    $(".container").hide();
})
// 服务中心
$(".activity-title").click(function() {
    const index = $(this).parent('.activity').attr('data-index');
    const flag = $(this).parent('.activity').attr('data-flag');
    $.ajax({ 
        // ${process.env.BASE_API}
        url: `${process.env.BASE_API}school-map/serviceInfo/getByType?type=${index}`, 
        success: function(res){
            if(res.code == 200) {
                const schoolList = res.data;
                $('.open:eq('+ index +')').html('')
                schoolList.forEach((item, ind) => {
                    let str = '';
                    if( item.positions.length > 1 ) {
                        item.positions.forEach(items => {
                            str += `
                            <div class="place" data-center="${items.center}">
                                ${items.title}
                            </div>
                            `
                        })
                    }
                     if(index == 3) {
                        $('.open:eq('+ index +')').append(
                            `
                            <div class="open-con" data-flag="true" style="font-size: .24rem">
                                 ${item.description}
                             </div>
                            `
                        ) 
                    }else {
                        $('.open:eq('+ index +')').append(
                            `
                            <div class="open-con" data-flag="true">
                                 <p class="open-title">${item.title}</p>
                                 <div class="small-open">
                                     <div class="small-small">
                                         ${str ? str : item.description}
                                     </div>
                                 </div>
                             </div>
                            `
                        ) 
                    }

                });
                
                $('.activity').animate({
                    height: '.8rem', 
                },300)
                $('.activity').attr('data-flag', 'true')
                if(flag == "true") {
                    var length =  $('.activity:eq('+ index +')').find('.open-con').length + 1 || 1;
                    if(index == 3) {
                        $('.activity:eq('+ index +')').animate({
                            height: '3rem', 
                        },300)
                    }else {
                        $('.activity:eq('+ index +')').animate({
                            height: length * 1.95 + 'rem', 
                        },300)
                    }
                    $('.activity:eq('+ index +')').attr('data-flag', 'flase')
                }
                if(index == 3) {
                    $('.open-con').animate({
                        height: '2rem', 
                    },300)
                }else {
                    $('.open-con').animate({
                        height: '.8rem', 
                    },300)
                }
                $('.open-con').attr('data-flag', 'true')
                // 底下菜单切换
                $(".open-title").click(function() {
                    var flag = $(this).parent('.open-con').attr('data-flag');
                    $('.open-con').animate({
                        height: '.8rem', 
                    },300)
                    $('.open-con').attr('data-flag', 'true')
                    if(flag == "true") {
                        $(this).parent('.open-con').animate({
                            height: '4rem', 
                        },300)
                        $(this).parent('.open-con').attr('data-flag', 'flase')
                        $(this).parent('.open-con').siblings('.open-con').animate({
                            height: '.8rem', 
                        },300)
                    }
                    $('.place').click(function(){
                        $('.serach').hide();
                        $('.menu').hide();
                        $('.footer').hide();
                        $('.head').show().find('span').html('主页面');
                        const center = $(this).attr('data-center');
                        const name = $(this).html();
                        $(".service-container").hide();
                        $(".container").hide();
                        const endCenterArr = center.split(',');
                        loadStartImg(CalculationX(startPathX), CalculationZ(startPathZ))
                        loadEndImg(endCenterArr[0], endCenterArr[1])
                        axes(startPathX, startPathZ, endCenterArr[0], endCenterArr[1])
                    })                        
                    
                })
            }
        }
    });      
})
// 导航
$('.daohang').click(function () {
    $('.distance').hide()
    // geolocation();
    // walk(initCenter, endPosition, name, true, true);
    geolocation();
})
// 视角切换
$('.3D').click(function () {
    window.location.href = './index.html?controlsFlag=3d';
})
$('.pingmian').click(function () {
    window.location.href = './index.html?controlsFlag=pingmian';  
})
$('.renwu').click(function() {
    window.location.href = './index.html?controlsFlag=renwu';
})
$('.manyou').click(function() {
    window.location.href = './index.html?controlsFlag=manyou';
})
/* 获取陀螺仪 */
// var text = "";  
window.addEventListener("deviceorientation", orientationHandler, false);  
function orientationHandler(event) {  
    // text = ""  
    // var arrow = document.getElementById("arrow");  
    // text += "左右旋转：rotate alpha{" + Math.round(event.alpha) + "deg)<br>";  
    // text += "前后旋转：rotate beta{" + Math.round(event.beta) + "deg)<br>";  
    // text += "扭转设备：rotate gamma{" + Math.round(event.gamma) + "deg)<br>";  
    // arrow.innerHTML = text;  
    if(controlsFlag == 'pingmian' || controlsFlag == '3d') {
        mesh.rotation.z = (event.alpha - 135)/180*Math.PI;
    }
    // mesh.rotation.z = Math.round(event.alpha + 90) * 6 / 360;
}
$('.amap-geo').hide();
if(controlsFlag == 'manyou') {
    $('#three').click(function() {
        controlsFlag = controlsFlag == 'manyou' ? 'manyou2' : 'manyou'     
    })
}

