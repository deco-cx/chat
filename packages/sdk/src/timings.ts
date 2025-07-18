export interface Timing {
  name: string;
  desc?: string;
  start: number;
  end?: number;
}

export interface ServerTimingsBuilder {
  get: () => readonly Timing[];
  start: (
    name: string,
    desc?: string,
    start?: number,
  ) => {
    end: (desc?: string) => void;
    setDesc: (desc: string | undefined) => void;
    name: () => string;
  } & Disposable;
  printTimings: () => string;
}

export function createServerTimings(): ServerTimingsBuilder {
  const timings: Timing[] = [];

  const start = (name: string, desc?: string, start?: number) => {
    const t: Timing = { name, desc, start: start || performance.now() };

    timings.push(t);

    return {
      end: (desc?: string) => {
        t.end = performance.now();
        t.desc = desc;
      },
      setDesc: (desc: string | undefined) => {
        t.desc = desc;
      },
      name: () => t.name,
      [Symbol.dispose]: () => {
        t.end = performance.now();
      },
    };
  };

  const printTimings = () =>
    timings
      .map(({ name, desc, start, end }) => {
        if (!end || !name) return;

        return `${encodeURIComponent(name)}${desc ? `;desc=${desc}` : ""};dur=${(
          end - start
        ).toFixed(0)}`;
      })
      .filter(Boolean)
      .join(", ");

  const get = (): readonly Timing[] => timings;

  return {
    get,
    start,
    printTimings,
  };
}
