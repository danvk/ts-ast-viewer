import React from "react";
import { instance as vizJsInstance, Viz } from "@viz-js/viz";

import { FlowFlags, FlowNode } from "typescript";
import { EnumUtils, flagUtils } from "../utils";
import { CompilerApi } from "../compiler";

export interface FlowNodeGraphProps {
  api: CompilerApi;
  flowNode: FlowNode;
}

function quoted(txt: string): string {
  return JSON.stringify(txt).slice(1, -1);
}

function getFlagText(api: CompilerApi, flags: FlowFlags) {
  // These are optimizations, not semantic flags.
  flags = flags & ~(FlowFlags.Shared | FlowFlags.Referenced);
  switch (flags) {
    case FlowFlags.TrueCondition:
    case FlowFlags.FalseCondition:
    case FlowFlags.Start:
    case FlowFlags.Assignment:
    case FlowFlags.BranchLabel:
    case FlowFlags.LoopLabel:
    case FlowFlags.Call:
      return EnumUtils.getNamesForValues(api.FlowFlags).find(e => e.value === flags)!.names[0];
  }
  const flagElements = flagUtils.getEnumFlagLines(api.FlowFlags, flags);
  const flagLines = flagElements ? flagElements.join("\\n") : String(flags);
  return `flags=${flagLines.length > 1 ? '\\n' : ''}${flagLines}`;
}

function getDotForFlowGraph(api: CompilerApi, node: FlowNode) {
  let nextId = 0;
  const getNextId = () => nextId++;
  const nodeIds = new Map<FlowNode, string>();
  const idForNode = (n: FlowNode) => {
    let id = nodeIds.get(n);
    if (id !== undefined) {
      return id;
    }
    id = 'n' + getNextId();
    nodeIds.set(n, id);
    return id;
  };

  const nodeLines = [];
  const edgeLines = [];

  const seen = new Set<FlowNode>();
  let fringe = [node];
  while (fringe.length) {
    const fn = fringe[0];
    fringe = fringe.slice(1);
    if (seen.has(fn)) {
      continue;
    }
    seen.add(fn);
    const id = idForNode(fn);

    let nodeText = null;
    if ('node' in fn && fn.node) {
      nodeText = fn.node.getText();
      if (nodeText.length > 50) {
        nodeText = nodeText.slice(0, 45) + '…';
      }
    }

    const flagText = getFlagText(api, fn.flags);
    const parts = [];
    if (nodeText) {
      parts.push(quoted(nodeText));
    }
    parts.push(flagText);
    nodeLines.push(`${id} [shape=record label="{${parts.join("|")}}"];`);
    const antecedents = 'antecedent' in fn ? [fn.antecedent] : ('antecedents' in fn && fn.antecedents) ? fn.antecedents : [];
    for (const antecedent of antecedents) {
      fringe.push(antecedent);
      const antId = idForNode(antecedent);
      edgeLines.push(`${id} -> ${antId};`);
    }
  }

  return `digraph {
    bgcolor=transparent
    rankdir="BT";
${nodeLines.map(line => '  ' + line).join('\n')}
${edgeLines.map(line => '  ' + line).join('\n')}
}`;
}

interface DotVizProps {
  dot: string;
}

function DotViz({dot}: DotVizProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [vizJs, setVizJs] = React.useState<Viz | null>(null);
  React.useEffect(() => {
    (async () => {
      setVizJs(await vizJsInstance());
    })();
  }, []);
  React.useEffect(() => {
    const div = ref.current;
    if (!div || !vizJs) {
      return;
    }
    div.innerHTML = '';
    div.appendChild(vizJs?.renderSVGElement(dot));
  }, [ref, dot, vizJs]);

  return (
    <div className="flowNodeGraph" ref={ref} />
  )
}

export function FlowNodeGraph({flowNode, api}: FlowNodeGraphProps) {
  const dot = React.useMemo(() => getDotForFlowGraph(api, flowNode), [flowNode]);
  // return <textarea rows={10} cols={40}>{dot}</textarea>;
  return <DotViz dot={dot} />;
}