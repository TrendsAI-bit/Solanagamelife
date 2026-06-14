function normalizeDelta(value) {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function toRelativeAxes(dx, dy, facing = 'S') {
  const stepX = normalizeDelta(dx);
  const stepY = normalizeDelta(dy);

  switch (facing) {
    case 'N':
      return { side: stepX, depth: -stepY };
    case 'S':
      return { side: -stepX, depth: stepY };
    case 'E':
      return { side: stepY, depth: stepX };
    case 'W':
      return { side: -stepY, depth: -stepX };
    default:
      return { side: -stepX, depth: stepY };
  }
}

function describeRelativeDirection(dx, dy, facing = 'S') {
  const { side, depth } = toRelativeAxes(dx, dy, facing);

  if (side === 0 && depth === 0) return 'nearby';
  if (depth > 0 && side < 0) return 'front-left';
  if (depth > 0 && side === 0) return 'ahead';
  if (depth > 0 && side > 0) return 'front-right';
  if (depth === 0 && side < 0) return 'left';
  if (depth === 0 && side > 0) return 'right';
  if (depth < 0 && side < 0) return 'back-left';
  if (depth < 0 && side === 0) return 'behind';
  return 'back-right';
}

module.exports = { describeRelativeDirection };
