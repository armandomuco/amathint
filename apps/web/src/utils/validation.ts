const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return emailPattern.test(value.trim());
}

export function isGreetingInput(value: string) {
  return /^(hi|hello|hey|pershendetje|tung|ckemi|c kemi|miremengjes|miredita|mirembrema)$/i.test(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
  );
}
