'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { RelationshipGraphNodeDto, RelationshipGraphResponse } from '@family/contracts';
import { ConnectedIdentity } from './connected-app-shell';
import { buildInteractiveTreeLayout, type InteractiveTreeNodeSeed } from './interactive-tree-model';
import styles from './relationship-tree.module.css';

interface FamilyNodeData extends Record<string, unknown> {
  seed: InteractiveTreeNodeSeed;
  onOpen: (memberId: string, opener: HTMLButtonElement) => void;
  onToggleBranch: (member: RelationshipGraphNodeDto) => void;
}

type FamilyFlowNode = Node<FamilyNodeData, 'family'>;

const FamilyNode = memo(function FamilyNode({ data }: NodeProps<FamilyFlowNode>) {
  const { seed, onOpen, onToggleBranch } = data;
  const { member } = seed;
  const name = member.familiar_name ?? member.display_name;

  return (
    <article
      className={seed.isRoot ? styles.flowNodeRoot : styles.flowNode}
      data-tree-node-id={member.id}
    >
      <span
        className={`family-tree-drag-handle ${styles.dragHandle}`}
        data-tree-drag-handle
        aria-hidden="true"
        title="Kéo để đổi vị trí tạm thời"
      >
        <i />
        <i />
        <i />
      </span>
      {seed.connectionLabel ? (
        <span className={styles.relationshipLabel}>{seed.connectionLabel}</span>
      ) : null}
      <button
        className={`nodrag nopan ${styles.profileAction}`}
        type="button"
        aria-label={`Mở hồ sơ ${member.display_name}`}
        onClick={(event) => onOpen(member.id, event.currentTarget)}
      >
        <ConnectedIdentity name={member.display_name} />
        <strong>{name}</strong>
        <small>{member.deceased ? 'Hồ sơ tưởng nhớ' : (member.hometown ?? 'Người thân')}</small>
      </button>
      {seed.hasBranch ? (
        <button
          className={`nodrag nopan ${styles.branchAction}`}
          type="button"
          aria-label={`${seed.collapsed ? 'Mở' : 'Thu'} nhánh ${name}`}
          aria-expanded={!seed.collapsed}
          onClick={() => onToggleBranch(member)}
        >
          <span aria-hidden="true">{seed.collapsed ? '+' : '−'}</span>
          {seed.collapsed ? 'Mở nhánh' : 'Thu nhánh'}
        </button>
      ) : null}
      <Handle className={styles.flowHandle} id="parent" type="target" position={Position.Top} />
      <Handle className={styles.flowHandle} id="child" type="source" position={Position.Bottom} />
      <Handle
        className={styles.flowHandle}
        id="partner-left"
        type="target"
        position={Position.Left}
      />
      <Handle
        className={styles.flowHandle}
        id="partner-right"
        type="source"
        position={Position.Right}
      />
    </article>
  );
});

const nodeTypes = { family: FamilyNode };

export function InteractiveTreeCanvas({
  graph,
  rootMemberId,
  onOpenProfile,
}: {
  graph: RelationshipGraphResponse;
  rootMemberId: string;
  onOpenProfile: (memberId: string, opener: HTMLButtonElement) => void;
}) {
  return (
    <ReactFlowProvider key={rootMemberId}>
      <InteractiveTreeCanvasInner
        graph={graph}
        rootMemberId={rootMemberId}
        onOpenProfile={onOpenProfile}
      />
    </ReactFlowProvider>
  );
}

function InteractiveTreeCanvasInner({
  graph,
  rootMemberId,
  onOpenProfile,
}: {
  graph: RelationshipGraphResponse;
  rootMemberId: string;
  onOpenProfile: (memberId: string, opener: HTMLButtonElement) => void;
}) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState('');
  const { fitView, setCenter, zoomIn, zoomOut } = useReactFlow<FamilyFlowNode>();
  const reduceMotion = useReducedMotion();

  const toggleBranch = useCallback((member: RelationshipGraphNodeDto) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      const wasCollapsed = next.delete(member.id);
      if (!wasCollapsed) next.add(member.id);
      setStatus(
        `${wasCollapsed ? 'Đã mở' : 'Đã thu'} nhánh của ${member.familiar_name ?? member.display_name}.`,
      );
      return next;
    });
  }, []);

  const layout = useMemo(
    () => buildInteractiveTreeLayout(graph, collapsedIds),
    [collapsedIds, graph],
  );
  const nextNodes = useMemo<FamilyFlowNode[]>(
    () =>
      layout.nodes.map((seed) => ({
        id: seed.id,
        type: 'family',
        position: seed.position,
        data: { seed, onOpen: onOpenProfile, onToggleBranch: toggleBranch },
        dragHandle: '.family-tree-drag-handle',
        draggable: true,
        selectable: false,
        focusable: false,
        connectable: false,
      })),
    [layout.nodes, onOpenProfile, toggleBranch],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<FamilyFlowNode>(nextNodes);

  useEffect(() => {
    setNodes((current) => {
      const positions = new Map(current.map((node) => [node.id, node.position]));
      return nextNodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? node.position,
      }));
    });
  }, [nextNodes, setNodes]);

  const edges = useMemo<Edge[]>(
    () =>
      layout.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.kind === 'partnership' ? 'partner-right' : 'child',
        targetHandle: edge.kind === 'partnership' ? 'partner-left' : 'parent',
        type: edge.kind === 'partnership' ? 'straight' : 'smoothstep',
        focusable: false,
        selectable: false,
        className:
          edge.kind === 'partnership'
            ? (styles.partnershipEdge ?? '')
            : edge.subtype === 'adoptive'
              ? (styles.adoptiveEdge ?? '')
              : (styles.parentChildEdge ?? ''),
        ariaLabel:
          edge.kind === 'partnership'
            ? 'Quan hệ bạn đời đã xác nhận'
            : 'Quan hệ cha mẹ và con đã xác nhận',
      })),
    [layout.edges],
  );

  const duration = reduceMotion ? 0 : 240;
  const centerRoot = useCallback(() => {
    const root = nodes.find((node) => node.id === rootMemberId);
    if (!root) return;
    const width = root.measured?.width ?? 148;
    const height = root.measured?.height ?? 156;
    void setCenter(root.position.x + width / 2, root.position.y + height / 2, {
      zoom: 1,
      duration,
    });
  }, [duration, nodes, rootMemberId, setCenter]);

  return (
    <section className={styles.interactiveTree} role="region" aria-label="Cây gia phả tương tác">
      <div className={styles.treeToolbar} aria-label="Điều khiển cây gia phả">
        <div>
          <button type="button" aria-label="Thu nhỏ" onClick={() => void zoomOut({ duration })}>
            <span aria-hidden="true">−</span>
          </button>
          <button type="button" aria-label="Phóng to" onClick={() => void zoomIn({ duration })}>
            <span aria-hidden="true">+</span>
          </button>
        </div>
        <button
          type="button"
          aria-label="Vừa cây"
          onClick={() => void fitView({ padding: 0.24, duration })}
        >
          Vừa cây
        </button>
        <button type="button" aria-label="Về tôi" onClick={centerRoot}>
          Về tôi
        </button>
      </div>

      <p className={styles.gestureHint}>Kéo nền để xem · Chụm hai ngón để phóng to</p>
      <div className={styles.flowViewport}>
        <ReactFlow<FamilyFlowNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_, node) =>
            setStatus(
              `Đã đổi vị trí tạm thời của ${node.data.seed.member.familiar_name ?? node.data.seed.member.display_name}.`,
            )
          }
          minZoom={0.48}
          maxZoom={1.65}
          fitView
          fitViewOptions={{ padding: 0.24 }}
          panOnDrag
          zoomOnPinch
          zoomOnScroll
          zoomOnDoubleClick={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          preventScrolling={false}
          nodeClickDistance={5}
        />
      </div>
      <p className={styles.srStatus} aria-live="polite">
        {status}
      </p>
    </section>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}
