const owners = new Set<symbol>();
let booting = true;

function update() {
  const screen = document.getElementById('app-startup');
  if (screen) screen.hidden = !booting && owners.size === 0;
}

export function retainStartupScreen() {
  const owner = Symbol();
  owners.add(owner);
  update();
  return () => {
    owners.delete(owner);
    update();
  };
}

export function finishStartupBoot() {
  booting = false;
  update();
}
