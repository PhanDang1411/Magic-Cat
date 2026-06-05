console.log("WAND FLICK MODE is starting...");

const videoElement = document.getElementById('input_video');
const canvasElement = document.querySelector('canvas'); 

// Chấm tròn báo hiệu
const cursor = document.createElement('div');
cursor.style.position = 'absolute';
cursor.style.width = '15px';
cursor.style.height = '15px';
cursor.style.borderRadius = '50%';
cursor.style.backgroundColor = 'rgba(0, 255, 255, 0.8)';
cursor.style.pointerEvents = 'none';
cursor.style.zIndex = '9999';
cursor.style.transform = 'translate(-50%, -50%)';
cursor.style.boxShadow = '0 0 10px cyan';
document.body.appendChild(cursor);

let isDrawing = false;
let lastGesture = "none"; // Khóa: Nhớ xem dáng tay trước đó là gì

function isExtended(hand, tipIndex) {
    let pipIndex = tipIndex - 2;
    let wrist = 0;
    let distTip = Math.pow(hand[tipIndex].x - hand[wrist].x, 2) + Math.pow(hand[tipIndex].y - hand[wrist].y, 2);
    let distPip = Math.pow(hand[pipIndex].x - hand[wrist].x, 2) + Math.pow(hand[pipIndex].y - hand[wrist].y, 2);
    return distTip > distPip;
}

function dispatchMouseEvent(eventType, x, y) {
    if(!canvasElement) return;
    const event = new MouseEvent(eventType, {
        clientX: x, clientY: y, bubbles: true, cancelable: true, view: window,
        buttons: eventType === 'mouseup' ? 0 : 1 
    });
    canvasElement.dispatchEvent(event);
}

// HỆ THỐNG VẼ CHUẨN XÁC
async function autoDrawShape(shapeType) {
    if (isDrawing) return;
    isDrawing = true;
    
    // Luôn vẽ ở chính giữa màn hình game
    const rect = canvasElement.getBoundingClientRect();
    let centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;

    cursor.style.backgroundColor = 'yellow';
    dispatchMouseEvent('mousedown', centerX, centerY);
    
    // Rút ngắn kích thước nét vẽ một chút để nét vẽ bay nhanh hơn
    let segments = [];
    if (shapeType === 'horizontal') segments = [{x: 150, y: 0}]; 
    else if (shapeType === 'vertical') segments = [{x: 0, y: -150}]; 
    else if (shapeType === 'v') segments = [{x: 50, y: 100}, {x: 100, y: 0}]; 
    else if (shapeType === '^') segments = [{x: 50, y: -100}, {x: 100, y: 0}]; 
    else if (shapeType === 'lightning') segments = [{x: -30, y: 80}, {x: 50, y: 60}, {x: -30, y: 140}]; 
    else if (shapeType === 'heart') segments = [{x: -40, y: -40}, {x: -80, y: 0}, {x: 0, y: 100}, {x: 80, y: 0}, {x: 40, y: -40}, {x: 0, y: 0}]; 

    let currX = centerX;
    let currY = centerY;

    for (let seg of segments) {
        let targetX = centerX + seg.x;
        let targetY = centerY + seg.y;
        
        let steps = 5; 
        for(let i = 1; i <= steps; i++) {
            let stepX = currX + (targetX - currX) * (i/steps);
            let stepY = currY + (targetY - currY) * (i/steps);
            dispatchMouseEvent('mousemove', stepX, stepY);
            await new Promise(r => setTimeout(r, 15)); // Chờ 15ms cho game lưu nét vẽ
        }
        currX = targetX;
        currY = targetY;
    }

    dispatchMouseEvent('mouseup', currX, currY);
    cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.5)'; // Đổi sang màu đỏ báo hiệu ĐÃ KHÓA CHIÊU
    
    // Đợi 0.1 giây để game hoàn thành việc diệt ma
    await new Promise(r => setTimeout(r, 100));
    isDrawing = false;
}

// LOGIC CỬ CHỈ BÀN TAY (CÓ KHÓA SPAM)
function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        
        let screenX = (1 - hand[8].x) * window.innerWidth; 
        let screenY = hand[8].y * window.innerHeight;
        
        // Chỉ di chuyển chấm con trỏ khi không bận vẽ
        if(!isDrawing) {
            cursor.style.left = screenX + 'px';
            cursor.style.top = screenY + 'px';
        }

        if (isDrawing) return;

        const indexUp = isExtended(hand, 8);
        const middleUp = isExtended(hand, 12);
        const ringUp = isExtended(hand, 16);
        const pinkyUp = isExtended(hand, 20);

        let currentGesture = "none";

        // 1. Phân loại dáng tay
        if (indexUp && middleUp && ringUp && pinkyUp) {
            currentGesture = 'heart';
        } else if (indexUp && middleUp && ringUp && !pinkyUp) {
            currentGesture = 'lightning';
        } else if (indexUp && middleUp && !ringUp && !pinkyUp) {
            if (hand[8].y > hand[5].y) currentGesture = '^';
            else currentGesture = 'v';
        } else if (indexUp && !middleUp && !ringUp && !pinkyUp) {
            let dx = Math.abs(hand[8].x - hand[5].x) * window.innerWidth;
            let dy = Math.abs(hand[8].y - hand[5].y) * window.innerHeight;
            if (dx > dy) currentGesture = 'horizontal';
            else currentGesture = 'vertical';
        }

        // 2. CƠ CHẾ VẨY ĐŨA (Khóa spam)
        // Nếu dáng tay là một chiêu thức hợp lệ VÀ khác với lần tung chiêu trước đó (hoặc trước đó đã cụp tay)
        if (currentGesture !== "none" && currentGesture !== lastGesture) {
            autoDrawShape(currentGesture);
            lastGesture = currentGesture; // Khóa lại, giữ nguyên tay sẽ không bắn ra chiêu nữa
        } 
        // Nếu cụp tay lại (không dơ ngón nào) -> Mở khóa để chuẩn bị tung chiêu tiếp theo
        else if (currentGesture === "none") {
            lastGesture = "none"; 
            cursor.style.backgroundColor = 'rgba(0, 255, 255, 0.8)'; // Chuyển xanh báo hiệu SẴN SÀNG
        }
    }
}

const hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 640, height: 480
});
camera.start();