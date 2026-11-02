"""生成选定骨架的最小闭合边覆盖路线（NetworkX blossom + 欧拉回路）。
运行：python tools/patrol_route.py；依赖 playwright、networkx。不是全连续校园的全局最优声明。
"""
from pathlib import Path
import json, sys
import networkx as nx
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tests'))
from browser_case import BrowserCase
ROOT=Path(__file__).resolve().parents[1]
def generate(data):
    g=nx.Graph()
    for i in sorted(data['patrolEdges']):
        e=data['edges'][i]
        g.add_edge(e['a'],e['b'],weight=e['weight'],index=i)
    assert nx.is_connected(g)
    odd=sorted(n for n in g if g.degree(n)%2)
    closure=nx.Graph()
    for i,a in enumerate(odd):
        for b in odd[i+1:]:
            distance=nx.shortest_path_length(g,a,b,weight='weight')
            closure.add_edge(a,b,weight=distance)
    matching=sorted(tuple(sorted(p)) for p in nx.min_weight_matching(closure,weight='weight'))
    multi=nx.MultiGraph()
    for a,b in sorted(g.edges()):multi.add_edge(a,b,**g[a][b])
    extra=0
    for a,b in matching:
        p=nx.shortest_path(g,a,b,weight='weight')
        for u,v in zip(p,p[1:]):
            multi.add_edge(u,v,**g[u][v]);extra+=g[u][v]['weight']
    assert nx.is_eulerian(multi)
    tour=list(nx.eulerian_circuit(multi,source='admin1:stairs',keys=True))
    nodes=['admin1:stairs']+[b for a,b,k in tour]
    assert nodes[-1]==nodes[0]
    covered={tuple(sorted((a,b))) for a,b,k in tour}
    assert covered=={tuple(sorted(e)) for e in g.edges()}
    base=sum(e['weight'] for a,b,e in g.edges(data=True))
    goals=['admin1:stairs']
    for host in ('admin','lab','teach'):
        if host!='admin':goals += [host+'1:stairs']
        for f in range(1,6):goals += [f'{host}{f}:stairs',f'{host}{f}:east']
        goals += [host+('1' if host=='teach' else '2')+':stairs']
        if host=='admin':goals += ['admin2:link1','link1:north','link1:south','lab2:link1']
        if host=='lab':goals += ['lab2:link2','link2:north','link2:south','teach2:link2']
    goals += ['out:'+s for s in ['teach','bell','garden','dormN','canteen','dormS','southgate','trash','eastroad','northgate','guard','garage','playground','gear','lab','admin','garw','westgate','admin']]
    goals += ['admin1:stairs']
    original=0;seen=set()
    def walk(a,b):
        nonlocal original
        p=nx.shortest_path(g,a,b,weight='weight')
        for u,v in zip(p,p[1:]):original+=g[u][v]['weight'];seen.add(tuple(sorted((u,v))))
    for a,b in zip(goals,goals[1:]):walk(a,b)
    # 初始候选未走过的骨架边补一次闭合往返，两个候选满足同一覆盖约束。
    for a,b in sorted(g.edges()):
        if tuple(sorted((a,b))) not in seen:
            walk('admin1:stairs',a);original+=g[a][b]['weight'];seen.add(tuple(sorted((a,b))));walk(b,'admin1:stairs')
    report={'routeVersion':1,'scope':'仅选定带权校园骨架；不声明连续空间全局最优','nodes':nodes,
        'baseWeightSeconds':base,'matchingExtraSeconds':extra,'totalSeconds':base+extra,'initialCandidateSeconds':original,
        'coverage':{'requiredEdges':len(g.edges()),'coveredEdges':len(covered),'closed':True},'oddNodes':odd,'matching':matching,
        'edges':[{'a':a,'b':b,'seconds':e['weight'],'kind':data['edges'][e['index']]['kind']} for a,b,e in sorted(g.edges(data=True))]}
    return report
if __name__=='__main__':
    BrowserCase.setUpClass();t=BrowserCase();t.setUp()
    try: data=t.page().evaluate('PatrolNav.graph()')
    finally:t.tearDown();BrowserCase.tearDownClass()
    r=generate(data)
    (ROOT/'game3d/js/modules/patrol-world/route.js').write_text("/* tools/patrol_route.py 生成；权重为 16 单位/秒步行与每层 2 秒楼梯。 */\n'use strict';\nvar PATROL_ROUTE="+json.dumps({'routeVersion':1,'nodes':r['nodes']},separators=(',',':'))+';\n')
    (ROOT/'docs/巡察路线生成报告.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in r.items() if k not in ('nodes','edges','oddNodes','matching')},ensure_ascii=False))
