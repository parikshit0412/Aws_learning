import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class EcommerceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Dedicated VPC with Public Subnets
    const vpc = new ec2.Vpc(this, 'EcommerceVpc', {
      maxAzs: 2,
      natGateways: 0, // Keep costs low; public subnet only
      subnetConfiguration: [
        {
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // 2. Security Group allowing HTTP, Monitoring, and SSH
    const securityGroup = new ec2.SecurityGroup(this, 'EcommerceSecurityGroup', {
      vpc,
      description: 'Security group for Ecommerce Backend (HTTP, Prometheus, Grafana, SSH)',
      allowAllOutbound: true,
    });

    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic through Nginx');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(9090), 'Allow Prometheus dashboard');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3001), 'Allow Grafana dashboard');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH access');

    // 3. IAM Role for Instance (Enables AWS Systems Manager Session Manager - no SSH keys required!)
    const role = new iam.Role(this, 'EcommerceInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // 4. Amazon Linux 2023 / Ubuntu Machine Image
    const machineImage = ec2.MachineImage.latestAmazonLinux2023();

    // 5. EC2 Instance (t3.medium recommended for Kafka + Postgres + Redis)
    const instance = new ec2.Instance(this, 'EcommerceAppServer', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      machineImage,
      securityGroup,
      role,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
    });

    // 6. UserData: Automatic Docker & Docker Compose setup on boot
    instance.userData.addCommands(
      'dnf update -y',
      'dnf install -y docker git',
      'systemctl enable docker',
      'systemctl start docker',
      'usermod -aG docker ec2-user',
      'mkdir -p /usr/local/lib/docker/cli-plugins',
      'curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose',
      'chmod +x /usr/local/lib/docker/cli-plugins/docker-compose',
      'echo "=== System Boot Finished ===" > /var/log/boot-ready.log'
    );

    // 7. CloudFormation Outputs
    new cdk.CfnOutput(this, 'InstancePublicIP', {
      value: instance.instancePublicIp,
      description: 'Public IP of the deployed EC2 instance',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: `http://${instance.instancePublicIp}`,
      description: 'Application URL (Port 80 via Nginx)',
    });

    new cdk.CfnOutput(this, 'GrafanaDashboard', {
      value: `http://${instance.instancePublicIp}:3001`,
      description: 'Grafana Dashboard URL',
    });

    new cdk.CfnOutput(this, 'PrometheusMetrics', {
      value: `http://${instance.instancePublicIp}:9090`,
      description: 'Prometheus Metrics URL',
    });
  }
}

