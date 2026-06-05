let _pendingAppid: number | null = null;

export function setPendingAppid(appid: number): void {
  _pendingAppid = appid;
}

export function getPendingAppid(): number | null {
  const id = _pendingAppid;
  _pendingAppid = null;
  return id;
}
