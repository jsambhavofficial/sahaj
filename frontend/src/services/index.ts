import { IDataService } from "./dataService";
import { MockDataService } from "./mockDataService";
import { HttpDataService } from "./httpDataService";

const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE || "mock";

let serviceInstance: IDataService;

if (dataSource.toLowerCase() === "live") {
  serviceInstance = new HttpDataService();
} else {
  serviceInstance = new MockDataService();
}

export function getDataService(): IDataService {
  return serviceInstance;
}

export * from "./dataService";
export * from "./mockDataService";
export * from "./httpDataService";
export * from "./apiClient";

