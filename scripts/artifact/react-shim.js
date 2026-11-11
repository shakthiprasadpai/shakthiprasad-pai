// The artifact page loads React 18 from cdnjs as a global, so the repo's `react` import is mapped onto it.
const R = window.React;
export const { useState, useMemo, useEffect, useRef, useCallback, Component } = R;
export default R;
