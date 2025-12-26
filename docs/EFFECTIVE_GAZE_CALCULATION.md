# Effective Gaze Calculation Logic

## 📊 Overview

**Effective Gaze** là góc nhìn thực tế của user sau khi kết hợp:
1. **Head Pose** (góc xoay đầu)
2. **Iris Gaze** (hướng mắt nhìn)
3. **Face Distance** (khoảng cách đến camera)
4. **Screen Metrics** (kích thước và độ phân giải màn hình)
5. **Calibration** (baseline cá nhân hóa)

---

## 🔧 Implementation: `calculateEffectiveGaze()`

### Input Parameters

```typescript
calculateEffectiveGaze(
    headPose: HeadPose,
    options: {
        irisGaze?: IrisGaze | null;
        faceDistance?: number;              // Relative distance (1.0 = baseline)
        screenMetrics?: ScreenMetrics;
        calibration?: GazeCalibration | null;
    }
): EffectiveGazeResult
```

---

## 📐 Calculation Steps

### **Step 1: Base Thresholds**

Lấy threshold từ calibration hoặc defaults:

```typescript
// With calibration (personalized)
thresholds = {
    maxPitchUp: |calibration.boundaries.minPitch| * 1.3,
    maxPitchDown: calibration.boundaries.maxPitch * 1.3,
    maxYaw: max(|minYaw|, maxYaw) * 1.3
};

// Without calibration (defaults)
thresholds = {
    maxPitchUp: 20°,
    maxPitchDown: 30°,
    maxYaw: 25°
};
```

**Margin 1.3x** = cho 30% tolerance ngoài calibrated range.

---

### **Step 2: Face Distance Adjustment**

Distance affects detection sensitivity:

```typescript
if (faceDistance > 1.2) {
    // Very close to camera
    distanceMultiplier = 0.8;  // Stricter (-20%)
}
else if (faceDistance < 0.8) {
    // Far from camera
    distanceMultiplier = 1.3;  // Looser (+30%)
}
else {
    distanceMultiplier = 1.0;  // Normal
}
```

**Rationale:**
- **Close (>1.2x)**: Small head movements are very visible → stricter thresholds
- **Far (<0.8x)**: Need larger movements to be noticeable → looser thresholds

**Example:**
```
Baseline: MAX_YAW = 25°

Close (1.3x):  25° * 0.8 = 20° (stricter)
Normal (1.0x): 25° * 1.0 = 25°
Far (0.7x):    25° * 1.3 = 32.5° (looser)
```

---

### **Step 3: Screen Metrics Adjustment**

Screen size and DPR affect viewing:

```typescript
// Large screen (>= 2560px width)
if (width >= 2560) {
    screenMultiplier *= 1.15;  // +15% (user sits farther)
}

// Small screen (<= 1366px width)
if (width <= 1366) {
    screenMultiplier *= 0.9;   // -10% (user sits closer)
}

// High DPR (Retina, 4K)
if (devicePixelRatio >= 2.0) {
    screenMultiplier *= 0.95;  // -5% (more precision)
}
```

**Rationale:**
- **Large screens**: Users typically sit farther → looser thresholds
- **Small screens**: Users sit closer → stricter thresholds
- **High DPR**: Better detection precision → slightly stricter

**Example:**
```
27" Monitor (2560x1440):     multiplier = 1.15
MacBook Pro 13" (Retina):    multiplier = 0.9 * 0.95 = 0.855
Standard 15" Laptop (1080p): multiplier = 1.0
```

---

### **Step 4: Combine Adjustments**

```typescript
combinedMultiplier = distanceMultiplier * screenScaleFactor;

finalThresholds = {
    maxPitchUp: baseThresholds.maxPitchUp * combinedMultiplier,
    maxPitchDown: baseThresholds.maxPitchDown * combinedMultiplier,
    maxYaw: baseThresholds.maxYaw * combinedMultiplier
};
```

**Example Scenario:**
```
Base:     MAX_YAW = 25°
Distance: 1.3x → multiplier = 0.8
Screen:   2560px → multiplier = 1.15

Final: 25° * 0.8 * 1.15 = 23° (close to large screen)
```

---

### **Step 5: Iris Contribution (Dynamic)**

Iris gaze compensates for head pose with **distance-scaled precision**:

```typescript
// Base: iris range -1 to +1 → ±30° eye movement
let irisCompensationDegrees = 30;

// Scale by face distance (closer = more reliable iris tracking)
if (faceDistance) {
    irisCompensationDegrees *= clamp(faceDistance, 0.8, 1.2);
}

irisContribution = {
    pitch: irisGaze.verticalGaze * irisCompensationDegrees,
    yaw: irisGaze.horizontalGaze * irisCompensationDegrees
};
```

**Rationale:**
- **Close face (1.2x)**: Iris tracking more precise → contribution = ±36° (30 * 1.2)
- **Far face (0.8x)**: Iris tracking less reliable → contribution = ±24° (30 * 0.8)
- **Normal (1.0x)**: Standard contribution = ±30°

**Why Dynamic?**
- Iris landmarks are more accurate when face is closer to camera
- Farther faces have less precise iris positions → reduce compensation

---

### **Step 6: Calculate Effective Gaze**

Combine head pose + iris contribution:

```typescript
effectivePitch = headPose.pitch + irisContribution.pitch;
effectiveYaw = headPose.yaw + irisContribution.yaw;
```

**Example:**
```
Head: pitch=20° (looking down)
Iris: verticalGaze=-0.5 (eyes looking up)
Compensation: 30° (normal distance)

Iris contribution: -0.5 * 30° = -15°
Effective pitch: 20° + (-15°) = 5°

Result: Head down but eyes up → actually looking near center
```

---

### **Step 7: Violation Detection**

Check effective gaze against final thresholds:

```typescript
lookingUp    = effectivePitch < -finalThresholds.maxPitchUp;
lookingDown  = effectivePitch > finalThresholds.maxPitchDown;
lookingLeft  = effectiveYaw > finalThresholds.maxYaw;
lookingRight = effectiveYaw < -finalThresholds.maxYaw;

isViolation = lookingUp || lookingDown || lookingLeft || lookingRight;
```

**Violation Severity** (0-1 scale):

```typescript
// How far beyond threshold as percentage
if (lookingUp) {
    excess = (-effectivePitch - maxPitchUp) / maxPitchUp;
}
// Example: threshold=20°, actual=-30° → excess = (30-20)/20 = 0.5 (50% beyond)

violationSeverity = clamp(excess, 0, 1);
```

---

## 📈 Complete Example

### Scenario: User với MacBook Pro 13" Retina, gần camera

**Input:**
```typescript
headPose = { pitch: 25°, yaw: 15° }  // Looking down-left
irisGaze = { verticalGaze: -0.4, horizontalGaze: 0.2 }  // Eyes up-left
faceDistance = 1.15  // Close to camera
screenMetrics = { width: 2560, height: 1600, DPR: 2 }
calibration = null  // No calibration
```

**Step 1: Base Thresholds**
```
maxPitchUp: 20°
maxPitchDown: 30°
maxYaw: 25°
```

**Step 2: Distance Adjustment**
```
faceDistance = 1.15 (normal range 0.8-1.2)
distanceMultiplier = 1.0  // No adjustment
```

**Step 3: Screen Adjustment**
```
width = 2560 → large screen → 1.15
DPR = 2 → high DPR → 0.95
screenMultiplier = 1.15 * 0.95 = 1.0925
```

**Step 4: Final Thresholds**
```
maxPitchUp: 20° * 1.0925 = 21.85°
maxPitchDown: 30° * 1.0925 = 32.77°
maxYaw: 25° * 1.0925 = 27.31°
```

**Step 5: Iris Contribution**
```
irisCompensation = 30° * 1.15 = 34.5° (close face)
pitch: -0.4 * 34.5 = -13.8°
yaw: 0.2 * 34.5 = 6.9°
```

**Step 6: Effective Gaze**
```
effectivePitch = 25° + (-13.8°) = 11.2°
effectiveYaw = 15° + 6.9° = 21.9°
```

**Step 7: Violation Check**
```
lookingUp? 11.2 < -21.85 → NO
lookingDown? 11.2 > 32.77 → NO
lookingLeft? 21.9 > 27.31 → NO
lookingRight? 21.9 < -27.31 → NO

isViolation = FALSE ✅
```

**Interpretation:**
- Head down 25° but eyes up -0.4
- Iris compensates -13.8° → effective only 11.2°
- Within threshold (< 32.77°)
- **User is reading exam, not looking away**

---

## 🎯 Key Design Decisions

### 1. **Dynamic Iris Compensation (24-36°)**

**Old approach** (fixed):
```typescript
pitch: headPose.pitch + (irisGaze.vertical * 15)  // Always ±15°
yaw: headPose.yaw + (irisGaze.horizontal * 10)   // Always ±10°
```

**New approach** (dynamic):
```typescript
compensation = 30° * clamp(faceDistance, 0.8, 1.2)  // 24-36° range
pitch: headPose.pitch + (irisGaze.vertical * compensation)
```

**Why?**
- Eye movement range is ~±30° naturally
- Iris tracking precision depends on face distance
- Closer face = more pixels per eye = more accurate tracking

### 2. **Multiplicative Adjustments**

All adjustments are **multiplicative**, not additive:

```typescript
finalThreshold = baseThreshold * distance * screen
```

**Why?**
- Preserves proportions
- Larger thresholds scale more than smaller ones
- Avoids negative thresholds with additive approach

### 3. **Conservative Adjustments**

All multipliers are close to 1.0 (80%-130% range):

```typescript
CLOSE_MULTIPLIER: 0.8     // -20%
FAR_MULTIPLIER: 1.3       // +30%
LARGE_SCREEN: 1.15        // +15%
SMALL_SCREEN: 0.9         // -10%
HIGH_DPR: 0.95           // -5%
```

**Why?**
- Avoid over-correction
- Maintain reasonable thresholds
- Gradual adjustments based on confidence

### 4. **Confidence Score**

```typescript
confidence = 0.5;  // Base confidence

if (irisGaze) confidence += 0.2;        // Iris data available
if (faceDistance) confidence += 0.15;   // Distance known
if (calibration) confidence += 0.15;    // Calibrated

// High DPR increases confidence slightly
if (screenMetrics.DPR >= 2) confidence += 0.05;

confidence = clamp(confidence, 0, 1);
```

**Why?**
- More data = higher confidence in violation detection
- Used for incident severity weighting
- Helps filter false positives

---

## ✅ Benefits of New Approach

1. **Personalized**: Adapts to each user's setup
2. **Context-aware**: Considers screen size, distance, DPR
3. **Accurate**: Dynamic iris compensation based on tracking quality
4. **Consistent**: Single source of truth for effective gaze
5. **Debuggable**: Rich result object with all intermediate values
6. **Fair**: Adjusts for hardware differences (laptop vs desktop)

---

## 🧪 Testing Recommendations

### Test 1: Distance variation
```
1. Calibrate at normal distance
2. Move closer (1.3x) → thresholds should be stricter
3. Move farther (0.7x) → thresholds should be looser
4. Trigger same head movement → different violation results
```

### Test 2: Screen size impact
```
1. Test on laptop (1920x1080) → stricter
2. Test on 4K monitor (3840x2160) → looser
3. Same head pose should have different violation status
```

### Test 3: Iris compensation
```
1. Look down 30° with head
2. Look up with eyes only (-0.8 iris)
3. Effective should be ~6° (30 - 24)
4. Should NOT trigger violation
```

### Test 4: Combined scenario
```
Setup: MacBook 13" (1440x900, DPR=2), close distance (1.2x)
Action: Head down 25°, eyes up -0.5
Expected: Effective ~13°, no violation
```

---

## 📊 Return Value Structure

```typescript
{
    // Final angles
    effectivePitch: 11.2,
    effectiveYaw: 21.9,

    // Components
    headPose: { pitch: 25, yaw: 15 },
    irisContribution: { pitch: -13.8, yaw: 6.9 },

    // Adjustments applied
    adjustments: {
        distanceMultiplier: 1.0,
        screenScaleFactor: 1.0925,
        calibrationApplied: false
    },

    // Final thresholds
    thresholds: {
        maxPitchUp: 21.85,
        maxPitchDown: 32.77,
        maxYaw: 27.31
    },

    // Violation info
    isViolation: false,
    violationDirection: 'none',
    violationSeverity: 0,

    // Confidence
    confidence: 0.85
}
```

---

## 🔍 Debug Tips

**Check logs:**
```
[EffectiveGaze] Distance: 1.15x → multiplier 1.0
[EffectiveGaze] Screen: 2560x1600 DPR:2 → multiplier 1.0925
[EffectiveGaze] Iris compensation: 34.5° (distance scaled)
[EffectiveGaze] Head: 25° + Iris: -13.8° = Effective: 11.2°
[EffectiveGaze] Threshold: 32.77° → NO VIOLATION
```

**UI Display:**
```
Head pose: pitch=25.0° yaw=15.0°
Iris: h=0.20 v=-0.40
Effective gaze: pitch=11.2° yaw=21.9°
Face dist: 1.15x (72px)
Screen: 2560x1600 (16:10) DPR:2
```

**Compare with isLookingAway():**
```typescript
// Old simple check (deprecated)
isLookingAway(headPose, irisGaze, calibration, faceDistance);

// New comprehensive check
const result = calculateEffectiveGaze(headPose, { ... });
const violation = result.isViolation;
```

---

## 📝 Migration Note

**Old code** (in useOptimizedDetection):
```typescript
// ❌ Simple fixed calculation
const effectiveGaze = headPose && irisGaze ? {
    pitch: headPose.pitch + (irisGaze.verticalGaze * 15),
    yaw: headPose.yaw + (irisGaze.horizontalGaze * 10)
} : null;
```

**New code** (unified):
```typescript
// ✅ Comprehensive calculation
const effectiveGazeResult = headPose ? calculateEffectiveGaze(headPose, {
    irisGaze,
    faceDistance: faceDistance?.relative,
    screenMetrics,
    calibration: calibrationRef.current
}) : null;

// Extract for UI display
const effectiveGaze = effectiveGazeResult ? {
    pitch: effectiveGazeResult.effectivePitch,
    yaw: effectiveGazeResult.effectiveYaw
} : null;
```

**Benefits:**
- Single source of truth
- Consistent across detection and UI
- Full metadata available for debugging
- Easy to extend with new factors
