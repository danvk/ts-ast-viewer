﻿/* barrel:ignore */
import ts from "typescript";

export interface StoreState {
    sourceFile: ts.SourceFile;
    selectedNode: ts.Node;
}
