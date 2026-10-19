/** Formes des réponses JSON de l'API Jenkins (champs demandés via `tree`). */

export interface JobItemDto {
  readonly _class: string;
  readonly name: string;
  readonly url: string;
  /** Présent uniquement pour les conteneurs (dossiers, multibranch, organisations). */
  readonly jobs?: readonly JobItemDto[];
}

export interface JobListDto {
  readonly jobs?: readonly JobItemDto[];
}

export interface BuildDto {
  readonly number: number;
  readonly timestamp: number;
  readonly duration: number;
  readonly estimatedDuration: number;
  readonly result: string | null;
  readonly building: boolean;
  readonly builtOn?: string;
  readonly url: string;
}

export interface JobBuildsDto {
  readonly builds?: readonly BuildDto[];
}

export interface ComputerDto {
  readonly displayName: string;
  readonly numExecutors: number;
  readonly offline: boolean;
  readonly idle: boolean;
}

export interface ComputerSetDto {
  readonly computer?: readonly ComputerDto[];
}
